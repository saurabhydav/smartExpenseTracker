package com.expensetracker.auth.service;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jwt.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey secretKey;
    private final long accessTokenExpiry;
    private final long refreshTokenExpiry;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiry}") long accessTokenExpiry,
            @Value("${jwt.refresh-token-expiry}") long refreshTokenExpiry) {

        // Ensure secret is at least 32 bytes for HS256
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] paddedKey = new byte[32];
            System.arraycopy(keyBytes, 0, paddedKey, 0, keyBytes.length);
            keyBytes = paddedKey;
        }

        this.secretKey = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.accessTokenExpiry = accessTokenExpiry;
        this.refreshTokenExpiry = refreshTokenExpiry;
    }

    public String generateAccessToken(Long userId, String email) {
        return generateToken(userId, email, accessTokenExpiry, "access");
    }

    public String generateRefreshToken(Long userId, String email) {
        return generateToken(userId, email, refreshTokenExpiry, "refresh");
    }

    private String generateToken(Long userId, String email, long expiryMs, String tokenType) {
        try {
            Date now = new Date();
            Date expiry = new Date(now.getTime() + expiryMs);

            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(userId.toString())
                    .claim("email", email)
                    .claim("type", tokenType)
                    .issueTime(now)
                    .expirationTime(expiry)
                    .jwtID(UUID.randomUUID().toString())
                    .build();

            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.HS256)
                    .type(JOSEObjectType.JWT)
                    .build();

            SignedJWT signedJWT = new SignedJWT(header, claims);
            signedJWT.sign(new MACSigner(secretKey));

            return signedJWT.serialize();

        } catch (JOSEException e) {
            log.error("Error generating JWT", e);
            throw new RuntimeException("Failed to generate token", e);
        }
    }

    public boolean validateToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(secretKey);

            if (!signedJWT.verify(verifier)) {
                log.warn("Token signature verification failed");
                return false;
            }

            Date expiration = signedJWT.getJWTClaimsSet().getExpirationTime();
            if (expiration.before(new Date())) {
                log.warn("Token has expired");
                return false;
            }

            return true;

        } catch (ParseException | JOSEException e) {
            log.error("Error validating token", e);
            return false;
        }
    }

    public Long getUserIdFromToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            return Long.parseLong(signedJWT.getJWTClaimsSet().getSubject());
        } catch (ParseException e) {
            log.error("Error extracting user ID from token", e);
            return null;
        }
    }

    public String getEmailFromToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            return signedJWT.getJWTClaimsSet().getStringClaim("email");
        } catch (ParseException e) {
            log.error("Error extracting email from token", e);
            return null;
        }
    }

    public String getTokenType(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            return signedJWT.getJWTClaimsSet().getStringClaim("type");
        } catch (ParseException e) {
            log.error("Error extracting token type", e);
            return null;
        }
    }

    public long getAccessTokenExpiry() {
        return accessTokenExpiry;
    }
}
