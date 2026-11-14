export type Role = "ADMIN" | "DISPATCHER" | "FLEET_MANAGER" | "CUSTOMER";

export interface ErrorResponse {
    status: number;
    code: string;
    message: string;
    timestamp: string;
}

export interface LoginResponse {
    token: string;
    role: Role;
    expiresAt: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    name: string;
    phone?: string;
    email?: string;
}

export interface RegisterResponse {
    publicId: string;
    username: string;
}

export interface Me {
    publicId: string | null;
    username: string;
    role: Role;
    name: string | null;
    email: string | null;
    phone: string | null;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface Page<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}

export type OrderStatus =
    | "CREATED"
    | "DISPATCHED"
    | "DRIVER_ENROUTE"
    | "ARRIVED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED";
export type DriverStatus = "AVAILABLE" | "BUSY" | "OFFLINE";
export type VehicleStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE";
export type StopType = "START" | "PICKUP" | "WAYPOINT" | "DROPOFF";
export type Severity = "LOW" | "MEDIUM" | "HIGH";

export interface Rate {
    rate: number | null;
    n: number;
}
