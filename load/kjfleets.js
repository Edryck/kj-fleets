import http from "k6/http";
import { check, sleep } from "k6";

const API = __ENV.K6_API_URL || "http://localhost:8081";
const CUSTOMERS = 50;
const PEAK = Number(__ENV.K6_PEAK || 1000);
const RUN = Date.now().toString(36);
const JSON_HEADERS = { "Content-Type": "application/json" };

export const options = {
    setupTimeout: "120s",
    scenarios: {
        browse: {
            executor: "ramping-vus",
            exec: "browse",
            startVUs: 0,
            stages: [
                { duration: "2m", target: PEAK },
                { duration: "3m", target: PEAK },
                { duration: "1m", target: 0 },
            ],
        },
        create: {
            executor: "constant-vus",
            exec: "create",
            vus: 50,
            duration: "3m",
            startTime: "2m",
        },
        loginStorm: {
            executor: "per-vu-iterations",
            exec: "loginStorm",
            vus: 200,
            iterations: 1,
            startTime: "3m",
        },
    },
    // primeiro chute; ajustado depois da primeira medição (ver docs/testing/load.md)
    thresholds: {
        http_req_failed: ["rate<0.01"],
        "http_req_duration{scenario:browse}": ["p(95)<800"],
        checks: ["rate>0.99"],
    },
};

function point(name) {
    return {
        name: `${name} ${RUN}`,
        address: "Rua da Carga, 1",
        lat: -24.87 + Math.random() * 0.05,
        lng: -54.33 - Math.random() * 0.05,
    };
}

function createOrder(token) {
    const response = http.post(
        `${API}/orders`,
        JSON.stringify({ pickup: point("Origem"), dropoff: point("Destino") }),
        { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` }, tags: { name: "POST /orders" } },
    );
    check(response, { "pedido criado (201)": (r) => r.status === 201 });
    return response;
}

export function setup() {
    const users = [];
    for (let i = 0; i < CUSTOMERS; i++) {
        const username = `load${RUN}${i}`;
        const password = "password-123";
        const registered = http.post(
            `${API}/auth/register`,
            JSON.stringify({ username, password, name: `Carga ${i}` }),
            { headers: JSON_HEADERS },
        );
        if (registered.status !== 201) throw new Error(`cadastro falhou: ${registered.status} ${registered.body}`);
        const login = http.post(`${API}/auth/login`, JSON.stringify({ username, password }), {
            headers: JSON_HEADERS,
        });
        const token = login.json("token");
        const order = createOrder(token);
        users.push({ username, password, token, tracking: order.json("trackingNumber") });
    }
    if (!users[0].tracking) throw new Error("resposta de POST /orders sem trackingNumber");
    return { users };
}

export function browse(data) {
    const user = data.users[__VU % data.users.length];
    const auth = { headers: { Authorization: `Bearer ${user.token}` } };
    check(http.get(`${API}/me`, { ...auth, tags: { name: "GET /me" } }), {
        "me 200": (r) => r.status === 200,
    });
    check(http.get(`${API}/orders?limit=20`, { ...auth, tags: { name: "GET /orders" } }), {
        "lista 200": (r) => r.status === 200,
    });
    check(http.get(`${API}/track/${user.tracking}`, { tags: { name: "GET /track/{code}" } }), {
        "rastreio 200": (r) => r.status === 200,
    });
    sleep(1 + Math.random() * 2);
}

export function create(data) {
    createOrder(data.users[__VU % data.users.length].token);
    sleep(1);
}

export function loginStorm(data) {
    const user = data.users[__VU % data.users.length];
    const response = http.post(
        `${API}/auth/login`,
        JSON.stringify({ username: user.username, password: user.password }),
        { headers: JSON_HEADERS, tags: { name: "POST /auth/login" } },
    );
    check(response, { "login 200": (r) => r.status === 200 });
}
