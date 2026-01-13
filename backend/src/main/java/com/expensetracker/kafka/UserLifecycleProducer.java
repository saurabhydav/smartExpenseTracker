package com.expensetracker.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Component
@SuppressWarnings("null")
public class UserLifecycleProducer {

    private static final Logger log = LoggerFactory.getLogger(UserLifecycleProducer.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topics.user-lifecycle:user-lifecycle}")
    private String userLifecycleTopic;

    @Value("${kafka.enabled:false}")
    private boolean kafkaEnabled;

    public UserLifecycleProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendUserCreatedEvent(Long userId, String email) {
        sendEvent("USER_CREATED", userId, email);
    }

    public void sendUserLoginEvent(Long userId, String email) {
        sendEvent("USER_LOGIN", userId, email);
    }

    public void sendUserDeletedEvent(Long userId, String email) {
        sendEvent("USER_DELETED", userId, email);
    }

    private void sendEvent(String eventType, Long userId, String email) {
        if (!kafkaEnabled) {
            log.info("Kafka disabled. Would have sent {} event for user: {}", eventType, email);
            return;
        }

        try {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", eventType);
            event.put("userId", userId);
            event.put("email", email);
            event.put("timestamp", Instant.now().toString());

            kafkaTemplate.send(userLifecycleTopic, String.valueOf(userId), event)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Failed to send {} event for user: {}", eventType, email, ex);
                        } else {
                            log.info("Sent {} event for user: {} to topic: {}",
                                    eventType, email, userLifecycleTopic);
                        }
                    });
        } catch (Exception e) {
            log.error("Error sending {} event for user: {}", eventType, email, e);
        }
    }
}
