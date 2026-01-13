package com.expensetracker.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
@ConditionalOnProperty(name = "kafka.enabled", havingValue = "true")
@SuppressWarnings("null")
public class KafkaConfig {

    @Value("${kafka.topics.user-lifecycle:user-lifecycle}")
    private String userLifecycleTopic;

    @Value("${kafka.topics.backup-audit:backup-audit}")
    private String backupAuditTopic;

    @Bean
    public NewTopic userLifecycleTopic() {
        return TopicBuilder.name(java.util.Objects.requireNonNull(userLifecycleTopic))
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic backupAuditTopic() {
        return TopicBuilder.name(backupAuditTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
