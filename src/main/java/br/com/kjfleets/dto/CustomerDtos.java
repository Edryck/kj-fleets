package br.com.kjfleets.dto;

import br.com.kjfleets.entity.Customer;

public final class CustomerDtos {

    private CustomerDtos() {
    }

    public record CustomerResponse(String publicId, String name, String phone, String email) {

        public static CustomerResponse from(Customer customer) {
            return new CustomerResponse(customer.getPublicId(), customer.getName(), customer.getPhone(),
                    customer.getEmail());
        }
    }
}
