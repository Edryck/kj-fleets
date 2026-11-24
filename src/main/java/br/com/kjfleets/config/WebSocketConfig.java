package br.com.kjfleets.config;

import br.com.kjfleets.security.StompAuthInterceptor;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
@EnableScheduling
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthInterceptor interceptor;

    public WebSocketConfig(StompAuthInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // origem liberada: a auth é o token no CONNECT, não cookie
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(interceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(interceptor::trackSockets);
    }

    // uma thread só: eventos do mesmo pedido ou motorista saem na ordem do commit. Fila limitada;
    // se encher, descarta e loga (o front relê o estado), em vez de acumular memória sob carga
    @Bean
    ThreadPoolTaskExecutor realtimeExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(10_000);
        executor.setThreadNamePrefix("realtime-");
        executor.setRejectedExecutionHandler((task, pool) -> LoggerFactory.getLogger(WebSocketConfig.class)
                .warn("Fila de eventos em tempo real cheia; evento descartado"));
        return executor;
    }
}
