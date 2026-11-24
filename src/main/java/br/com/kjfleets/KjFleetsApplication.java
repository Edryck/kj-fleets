package br.com.kjfleets;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableAsync
public class KjFleetsApplication {

    public static void main(String[] args) {
        SpringApplication.run(KjFleetsApplication.class, args);
    }
}
