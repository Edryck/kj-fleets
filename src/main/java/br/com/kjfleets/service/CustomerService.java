package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.CustomerDtos.CustomerResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.repository.CustomerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerService {

    private final CustomerRepository customers;

    public CustomerService(CustomerRepository customers) {
        this.customers = customers;
    }

    @Transactional(readOnly = true)
    public CustomerResponse get(String publicId) {
        return CustomerResponse.from(customers.findByPublicId(publicId)
                .orElseThrow(() -> BusinessException.notFound("Cliente")));
    }

    @Transactional(readOnly = true)
    public PageResponse<CustomerResponse> list(String q, Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        Page<Customer> page = q == null || q.isBlank()
                ? customers.findAllByOrderByNameAscPublicIdAsc(pageable)
                : customers.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrderByNameAscPublicIdAsc(
                        q.trim(), q.trim(), pageable);
        return PageResponse.of(page, CustomerResponse::from, pageable.getPageSize(), (int) pageable.getOffset());
    }
}
