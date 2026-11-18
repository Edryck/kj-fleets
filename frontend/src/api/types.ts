export type Role = "ADMIN" | "DISPATCHER" | "FLEET_MANAGER" | "CUSTOMER" | "DRIVER";

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
    distanceSource: DistanceSource | null;
    path: [number, number][] | null;
}

export type DistanceSource = "ROAD" | "HAVERSINE";

export interface OrderRoute {
    orderId: string;
    algorithm: string;
    mode: string;
    totalKm: number | null;
    baselineKm: number | null;
    savingsPct: number | null;
    etaMinutes: number | null;
    computedAt: string;
    fallbackLegs: number;
    stops: RouteStop[];
}

export interface Driver {
    publicId: string;
    username: string;
    name: string;
    phone: string | null;
    licenseNumber: string | null;
    status: DriverStatus;
    lat: number | null;
    lng: number | null;
    lastSeenAt: string | null;
    fleets: Ref[];
    vehicle: VehicleRef | null;
    active: boolean;
}

export interface Vehicle {
    publicId: string;
    plate: string;
    type: string;
    status: VehicleStatus;
    driverId: string | null;
    driverName: string | null;
    active: boolean;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    color?: string | null;
    capacityKg?: number | null;
    volumeM3?: number | null;
    odometerKm?: number | null;
}

export type VehicleRef = Pick<Vehicle, "publicId" | "plate" | "type"> &
    Pick<Vehicle, "brand" | "model" | "year" | "color" | "capacityKg" | "volumeM3" | "odometerKm">;

export interface Customer {
    publicId: string;
    name: string;
    phone: string | null;
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

export interface StaleOrder {
    orderId: string;
    trackingNumber: string;
    stage: string;
    minutesInStage: number;
    limitMin: number;
}

export interface DispatchQueue {
    unassigned: Paged<QueueItem>;
    assignedNotDispatched: Paged<QueueItem>;
    inProgress: Paged<InProgressItem>;
    stale?: Paged<StaleOrder>;
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
    distanceSource: DistanceSource | null;
    path: [number, number][] | null;
}

export interface OptimizeResponse {
    algorithm: string;
    stops: OptimizedStop[];
    totalKm: number;
    baselineKm: number;
    savingsPct: number;
    etaMinutes: number;
    comparison: Record<string, { totalKm: number; ms: number }> | null;
    fallbackLegs: number;
}

export interface GraphStatus {
    mode: string;
    loaded: boolean;
    region: string | null;
    osmFile: string | null;
    nodes: number;
    edges: number;
    importedAt: string | null;
    loadMillis: number;
    reason: string | null;
}

export interface GraphRoute {
    km: number;
    path: [number, number][];
    distanceSource: DistanceSource;
    ms: number;
}

export interface Meta {
    generatedAt: string;
    timezone: string;
    period: string;
    from: string | null;
    to: string | null;
}

export interface ReasonCount {
    reason: string;
    count: number;
}

export interface OrdersSummary {
    meta: Meta;
    created: number;
    completed: number;
    failed: number;
    cancelled: number;
    cancelledByCustomer: number;
    cancelledByStaff: number;
    cancelledByUnknown: number;
    successRate: Rate;
    failureRate: Rate;
    cancelRate: Rate;
    topFailureReasons: ReasonCount[];
    avgWaitMinutes: number | null;
    avgCycleMinutes: number | null;
    podRate: Rate;
    previous: OrdersSummary | null;
}

export interface Funnel {
    byStage: Record<string, number>;
    staleByStage: Record<string, number>;
}

export interface FleetCounts {
    driversByStatus: Record<string, number>;
    vehiclesByStatus: Record<string, number>;
    waitingOrders: number;
    availableDrivers: number;
}

export interface AlgorithmSavings {
    routes: number;
    savedKm: number;
    avgSavingsPct: number | null;
}

export interface RoutingSavings {
    routes: number;
    plannedKm: number;
    baselineKm: number;
    savedKm: number;
    avgSavingsPct: number | null;
    byAlgorithm: Record<string, AlgorithmSavings>;
    batchDispatchPct: Rate;
}

export interface RoutingReport extends RoutingSavings {
    meta: Meta;
}

export interface MonthPoint {
    month: string;
    created: number;
    completed: number;
    failed: number;
    cancelled: number;
    successRate: Rate;
    avgCycleMinutes: number | null;
    savedKm: number | null;
    avgSavingsPct: number | null;
}

export interface DriverMonth {
    driverId: string;
    name: string;
    month: string;
    completed: number;
}

export interface YearlyTrends {
    meta: Meta;
    months: MonthPoint[];
    byDriver: DriverMonth[];
}

export type AlertType =
    | "STALE_ORDER"
    | "DRIVER_NO_SIGNAL"
    | "STATUS_INCONSISTENT"
    | "VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER"
    | "DEMAND_OVER_CAPACITY"
    | "SUSPICIOUS_STOP"
    | "ROUTE_MISSING"
    | "LONG_MAINTENANCE";

export interface Alert {
    type: AlertType;
    severity: Severity;
    subjectType: string;
    subjectId: string | null;
    message: string;
    suggestedAction: string;
    since: string;
}

export interface Alerts {
    meta: Meta;
    items: Alert[];
    counts: Partial<Record<AlertType, number>>;
}

export interface AdminPanel {
    meta: Meta;
    summary: OrdersSummary;
    funnel: Funnel;
    fleet: FleetCounts;
    routing: RoutingSavings;
    alertCounts: Partial<Record<AlertType, number>>;
}

export interface DriverRow {
    driverId: string;
    name: string;
    status: DriverStatus;
    vehiclePlate: string | null;
    vehicleStatus: VehicleStatus | null;
    activeOrderId: string | null;
    queueSize: number;
    lastSeenAt: string | null;
    pingStale: boolean;
    lat: number | null;
    lng: number | null;
}

export interface DispatchPanel {
    meta: Meta;
    queue: DispatchQueue;
    availableDrivers: DriverRow[];
    counts: FleetCounts;
    summary: OrdersSummary;
    alerts: Alert[];
}

export interface FleetStatus extends FleetCounts {
    meta: Meta;
    drivers: DriverRow[];
    availableDriversList: DriverRow[];
}

export interface DriverPerformance {
    driverId: string;
    name: string;
    completed: number;
    failed: number;
    successRate: Rate;
    avgDispatchToArrivedMinutes: number | null;
    busyPct: number | null;
    orders: number;
}

export interface DriversPerformance {
    meta: Meta;
    drivers: DriverPerformance[];
    idleDriverIds: string[];
}

export interface DayPoint {
    day: string;
    ordersCreated: number;
    driversWithDelivery: number;
}

export interface FleetPanel {
    meta: Meta;
    fleet: FleetStatus;
    alerts: Alert[];
    performance: DriversPerformance;
    sizing: {
        waitingOrders: number;
        availableDrivers: number;
        perDay: DayPoint[];
    };
}

export interface CustomerActive {
    orderId: string;
    trackingNumber: string;
    status: OrderStatus;
    etaMinutes: number | null;
    stopsDone: number;
    stopsTotal: number;
    cancellable: boolean;
    driverName: string | null;
}

export interface CustomerAttention {
    orderId: string;
    trackingNumber: string;
    kind: "FAILED" | "STALE";
    reason: string | null;
    minutesInStage: number | null;
}

export interface CustomerDelivered {
    orderId: string;
    trackingNumber: string;
    finishedAt: string;
    hasPod: boolean;
}

export interface CustomerPanel {
    meta: Meta;
    active: CustomerActive[];
    attention: CustomerAttention[];
    summary: OrdersSummary;
    recentDelivered: CustomerDelivered[];
}

export interface TrackResponse {
    trackingNumber: string;
    status: OrderStatus;
    createdAt: string;
    finishedAt: string | null;
    etaMinutes: number | null;
    timeline: { code: string; status: OrderStatus; at: string }[];
}

export interface PlaceBody {
    name: string;
    address: string;
    lat: number;
    lng: number;
}

export interface UserAccount {
    publicId: string;
    username: string;
    role: Role;
    active: boolean;
}

export interface FleetSummary {
    publicId: string;
    name: string;
    driverCount: number;
}

export interface FleetDetail {
    publicId: string;
    name: string;
    drivers: Driver[];
}
