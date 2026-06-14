# `src/services/ReportService.ts` - In-Depth Technical Explanation

This file bridges intense SQLite Data Aggregation with Native Operating System rendering. It builds dynamic PDF documents entirely offline using HTML-to-PDF compilation.

---

### 1. Complex Aggregation Joins (Lines 22-101)
```typescript
export async function generateReportData(startDate: string, endDate: string): Promise<ReportData> {
  const db = getDatabase();
  const categories = await getCategories();

  const [categoryResult] = await db.executeSql(`
    SELECT category_id, SUM(amount) as total
    FROM transactions
    WHERE type = 'debit' AND date BETWEEN ? AND ?
    GROUP BY category_id ORDER BY total DESC
  `, [startDate, endDate]);

  // Merge logic
  for (let i = 0; i < categoryResult.rows.length; i++) {
    const row = categoryResult.rows.item(i);
    const category = categories.find(c => c.id === row.category_id) || { name: 'Uncategorized' };
    categoryBreakdown.push({
      category,
      amount: row.total,
      percentage: Math.round((row.total / totalSpending) * 100),
    });
  }
}
```
*   **Flow & Architecture**: Getting data ready for a PDF requires complex data shaping. It fires four independent, massive SQL Aggregate queries: Total Spending, Total Income, Top Merchants, and Daily Trends.
    - Notice the `GROUP BY category_id`: Rather than pulling 500 individual Uber and Swiggy transactions into RAM, the C++ layer of SQLite groups them and just returns a tiny array (e.g., `id 1 = $400, id 2 = $300`). 
    - The Javascript loop then maps these bare IDs against the local `categories` dictionary to attach the correct colors (`#e74c3c`), names, and mathematically calculates their pie-chart percentages.

---

### 2. Physical HTML Compilation (Lines 126-255)
```typescript
export function generateReportHtml(data: ReportData): string {
  const categoryRows = data.categoryBreakdown
    .map(item => `
      <tr>
        <td><span style="background: ${item.category.color};"></span>${item.category.name}</td>
        <td>${formatCurrency(item.amount)}</td>
        <td>${item.percentage}%</td>
      </tr>
    `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head><style>...</style></head>
      <body>
        <h1>${data.title}</h1>
        <!-- ... -->
        ${categoryRows}
      </body>
    </html>
  `
}
```
*   **Syntax Breakdown**: Pure Template Literals ``. It writes raw HTML/CSS strings into memory.
*   **Flow & Architecture**: React Native Native Modules (specifically PDF generators) do not know how to read React components. They only know how to read WebKit HTML. This function acts as a compiler. It loops through the `ReportData` array, injecting raw Table Rows `<tr>` into an old-school static HTML skeleton that includes hard-coded inline CSS for styling.

---

### 3. Graceful Native Module Fallbacks (Lines 260-323)
```typescript
export async function shareReport(startDate, endDate): Promise<boolean> {
    const data = await generateReportData(startDate, endDate);
    const html = generateReportHtml(data);
    const { PdfGenerator } = NativeModules;

    if (!PdfGenerator) {
      console.log('PdfGenerator module not found, falling back to text.');
      throw new Error('PdfGenerator not found');
    }

    try {
        const filePath = await PdfGenerator.convert(html, options.fileName);
        await Share.share({ url: `file://${filePath}`, type: 'application/pdf' });
    } catch (error) {
        // Fallback to text sharing
        const message = `${data.title}\nTotal Spending: ${formatCurrency(data.totalSpending)}...`;
        await Share.share({ message, title: data.title });
    }
}
```
*   **Syntax & Flow**: `NativeModules` tries to grab a custom Java/Kotlin bridge named `PdfGenerator`. 
*   **Flow & Architecture**: "Graceful Degradation". If a developer clones this repo but forgets to link the native C++ libraries, or if the user's phone OS blocks PDF generation, the app explicitly refuses to crash. It catches the thrown error, abandons the HTML payload, and dynamically constructs a plain-text WhatsApp-friendly summary string instead. It then invokes the OS Share Sheet (`Share.share`), presenting the user with options to AirDrop/WhatsApp the plain text.
