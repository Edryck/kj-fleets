package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.service.RealtimePublisher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

// achado da revisão: com o executor padrão (8 threads) dois eventos do mesmo pedido ou motorista podiam
// sair invertidos e a fila não tinha limite
class RealtimeOrderingTest extends IntegrationTest {

    @Autowired
    @Qualifier("realtimeExecutor")
    private ThreadPoolTaskExecutor executor;

    @Test
    void executorIsSingleThreadAndBounded() {
        assertThat(executor.getMaxPoolSize()).isEqualTo(1);
        assertThat(executor.getQueueCapacity()).isBetween(1, 100_000);
    }

    @Test
    void tasksRunInSubmissionOrder() throws Exception {
        List<Integer> seen = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch done = new CountDownLatch(200);
        for (int i = 0; i < 200; i++) {
            int n = i;
            executor.execute(() -> {
                seen.add(n);
                done.countDown();
            });
        }
        assertThat(done.await(10, TimeUnit.SECONDS)).isTrue();
        assertThat(seen).containsExactlyElementsOf(IntStream.range(0, 200).boxed().toList());
    }

    @Test
    void everyRealtimeListenerUsesTheOrderedExecutor() {
        for (Method method : RealtimePublisher.class.getDeclaredMethods()) {
            if (method.isAnnotationPresent(TransactionalEventListener.class)) {
                Async async = method.getAnnotation(Async.class);
                assertThat(async).as(method.getName()).isNotNull();
                assertThat(async.value()).as(method.getName()).isEqualTo("realtimeExecutor");
            }
        }
    }
}
