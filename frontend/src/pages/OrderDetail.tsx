import { useParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import type { ApiError } from "../api/http";
import { ErrorState, Skeleton } from "../components/blocks";
import Glass from "../glass/Glass";
import CustomerOrderView from "./order/CustomerOrderView";
import OrderDialogs from "./order/orderDialogs";
import StaffOrderView from "./order/StaffOrderView";
import { useOrderDetail } from "./order/useOrderDetail";
import { NotFound } from "./SystemPages";

export default function OrderDetail() {
    const { id = "" } = useParams();
    const state = useOrderDetail(id);
    const { order, isStaff } = state;

    if (order.isError) {
        const error = order.error as ApiError;
        const content =
            error.status === 404 || error.code === "NOT_FOUND" ? (
                <NotFound />
            ) : (
                <ErrorState
                    message={messageFor(error.code, error.message)}
                    onRetry={() => order.refetch()}
                />
            );
        return isStaff ? <Glass className="order-floating">{content}</Glass> : content;
    }

    if (!order.data) {
        return isStaff ? (
            <div className="order-staff">
                <div className="order-side">
                    <Glass as="section" className="order-left" aria-busy="true">
                        <Skeleton height={34} width="70%" />
                        <Skeleton height={220} />
                        <Skeleton height={44} />
                    </Glass>
                </div>
            </div>
        ) : (
            <div className="stack">
                <Skeleton height={36} width={320} />
                <Skeleton height={220} />
                <Skeleton height={220} />
            </div>
        );
    }

    const o = order.data;
    return (
        <>
            {isStaff ? (
                <StaffOrderView state={state} order={o} />
            ) : (
                <CustomerOrderView state={state} order={o} />
            )}
            <OrderDialogs state={state} order={o} />
        </>
    );
}
