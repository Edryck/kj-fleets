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

export interface Contact {
    name: string | null;
    phone: string | null;
    email: string | null;
}

export interface Place {
    publicId: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    contact: Contact | null;
    active: boolean;
}

export interface Ref {
    publicId: string;
    name: string;
}

export interface OrderSummary {
    publicId: string;
    trackingNumber: string;
    status: OrderStatus;
    createdAt: string;
    dispatchedAt: string | null;
    finishedAt: string | null;
    pickupName: string;
    dropoffName: string;
    waypointCount: number;
    driver: Ref | null;
    vehicle: { publicId: string; plate: string } | null;
    customer: Ref | null;
}

export interface OrderItem {
    name: string;
    quantity: number;
}

export interface OrderDetail {
    publicId: string;
    trackingNumber: string;
    status: OrderStatus;
    customer: Ref | null;
    driver: Ref | null;
    vehicle: { publicId: string; plate: string } | null;
    pickup: Place;
    dropoff: Place;
    waypoints: Place[];
    items: OrderItem[];
    podRequired: boolean;
    podValue: string | null;
    podAt: string | null;
    reason: string | null;
    notes: string | null;
    meta: Record<string, unknown> | null;
    createdAt: string;
    dispatchedAt: string | null;
    finishedAt: string | null;
}

export interface TrackingEntry {
    code: string;
    status: OrderStatus;
    details: string | null;
    lat: number | null;
    lng: number | null;
    at: string;
}

export interface RouteStop {
    seq: number;
    type: StopType;
    placeId: string | null;
    name: string;
    lat: number | null;
    lng: number | null;
    legKm: number | null;
    visitedAt: string | null;
    distanceM: number | null;
}

export interface OrderRoute {
    orderId: string;
    algorithm: string;
    mode: string;
    totalKm: number | null;
    baselineKm: number | null;
    savingsPct: number | null;
    etaMinutes: number | null;
    computedAt: string;
    stops: RouteStop[];
}

export interface Driver {
    publicId: string;
    name: string;
    status: DriverStatus;
    lat: number | null;
    lng: number | null;
    lastSeenAt: string | null;
    fleets: Ref[];
    vehicle: { publicId: string; plate: string } | null;
}

export interface Vehicle {
    publicId: string;
    plate: string;
    type: string;
    status: VehicleStatus;
}

export interface Customer {
    publicId: string;
    name: string;
    email: string | null;
}

export interface PointRequest {
    placeId?: string;
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
}

export interface CreateOrderRequest {
    customerId?: string;
    pickup: PointRequest;
    dropoff: PointRequest;
    waypoints: PointRequest[];
    items: OrderItem[];
    podRequired: boolean;
    notes?: string;
}

export interface QueueItem {
    orderId: string;
    trackingNumber: string;
    pickupName: string;
    dropoffName: string;
    minutesInStage: number;
}

export interface InProgressItem {
    orderId: string;
    status: string;
    driverId: string | null;
    driverName: string | null;
    etaMinutes: number | null;
    stopsDone: number;
    stopsTotal: number;
}

export interface Paged<T> {
    items: T[];
    total: number;
}

export interface DispatchQueue {
    unassigned: Paged<QueueItem>;
    assignedNotDispatched: Paged<QueueItem>;
    inProgress: Paged<InProgressItem>;
}

export type AssignmentAlgorithm = "HUNGARIAN" | "GREEDY";

export interface PlannedAssignment {
    orderId: string;
    driverId: string;
    vehicleId: string;
    km: number;
}

export interface PlanResponse {
    algorithm: AssignmentAlgorithm;
    applied: boolean;
    assignments: PlannedAssignment[];
    unassigned: string[];
    totalKm: number;
    comparison: Partial<Record<AssignmentAlgorithm, number>>;
}

export interface OptimizedStop {
    seq: number;
    type: StopType;
    lat: number;
    lng: number;
    legKm: number;
    waypointIndex: number | null;
}

export interface OptimizeResponse {
    algorithm: string;
    stops: OptimizedStop[];
    totalKm: number;
    baselineKm: number;
    savingsPct: number;
    etaMinutes: number;
    comparison: Record<string, { totalKm: number; ms: number }> | null;
}
