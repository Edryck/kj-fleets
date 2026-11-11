package br.com.kjfleets.dto;

import br.com.kjfleets.config.BusinessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.function.Function;

public record PageResponse<T>(List<T> items, long total, int limit, int offset) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> map, int limit, int offset) {
        return new PageResponse<>(page.getContent().stream().map(map).toList(), page.getTotalElements(), limit, offset);
    }

    public static Pageable pageable(Integer limit, Integer offset) {
        int size = limit == null ? 20 : limit;
        int skip = offset == null ? 0 : offset;
        if (size < 1 || skip < 0) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "limit deve ser >= 1 e offset >= 0");
        }
        return new OffsetPageable(skip, Math.min(size, 100));
    }

    // Pageable por página não serve para offset que não é múltiplo do limit
    record OffsetPageable(long offset, int limit) implements Pageable {

        @Override
        public int getPageNumber() {
            return (int) (offset / limit);
        }

        @Override
        public int getPageSize() {
            return limit;
        }

        @Override
        public long getOffset() {
            return offset;
        }

        @Override
        public Sort getSort() {
            return Sort.unsorted();
        }

        @Override
        public Pageable next() {
            return new OffsetPageable(offset + limit, limit);
        }

        @Override
        public Pageable previousOrFirst() {
            return hasPrevious() ? new OffsetPageable(Math.max(0, offset - limit), limit) : first();
        }

        @Override
        public Pageable first() {
            return new OffsetPageable(0, limit);
        }

        @Override
        public Pageable withPage(int pageNumber) {
            return new OffsetPageable((long) pageNumber * limit, limit);
        }

        @Override
        public boolean hasPrevious() {
            return offset > 0;
        }
    }
}
