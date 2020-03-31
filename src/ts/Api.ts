import { LiveVehicle } from "./types";

const API_URL = "https://mattm.win/atlive/api/v1/";
const WS_URL = "wss://mattm.win/atlive/api/v1/websocket";

// eslint-disable-next-line max-len
type QueryRouteInfo = "shortName" | "longName" | "longNames" | "routeIds" | "shapeIds" | "vehicles" | "type" | "agencyId" | "polylines";

interface RoutesResult {
    shortName?: string;
    longName?: string;
    longNames?: string[];
    routeIds?: string[];
    shapeIds?: string[];
    vehicles?: LiveVehicle[];
    type?: "bus" | "rail" | "ferry";
    agencyId?: string;
    polylines?: google.maps.LatLngLiteral[][];
}

class Api {
    ws: WebSocket;

    apiUrl: string;

    wsUrl: string;

    subscriptions: Set<string>;

    _onMessage: (data: Record<string, any>) => void;

    promiseWsConnect: Promise<void>;

    resolveWhenWsConnect: (value?: void | PromiseLike<void>) => void;

    constructor() {
        this.ws = null;
        this.apiUrl = API_URL;
        this.wsUrl = WS_URL;
        this.subscriptions = new Set();
        this._onMessage = null;

        this.promiseWsConnect = new Promise<void>(resolve => {
            this.resolveWhenWsConnect = resolve;
        });
    }

    async query(path: string, params: Record<string, string>): Promise<Record<string, any>> {
        const queryStr = `?${new URLSearchParams(params)}`;
        const response: Record<string, any> = await fetch(this.apiUrl + path + queryStr).then(r => r.json());
        if (response.status !== "success") {
            throw new Error(`Failed querying API: ${path}${queryStr}`);
        }
        return response;
    }

    async queryRoutes(shortNames?: string[], fetch?: QueryRouteInfo[]): Promise<Record<string, RoutesResult[]>> {
        const query: Record<string, string> = {};
        if (shortNames) query.shortNames = shortNames.join(",");
        if (fetch) query.fetch = fetch.join(",");
        return await this.query("routes", query) as Record<string, RoutesResult[]>;
    }

    async queryRoute(shortName: string, fetch?: QueryRouteInfo[]): Promise<RoutesResult> {
        const query: Record<string, string> = { shortNames: shortName };
        if (fetch) query.fetch = fetch.join(",");
        const response = await this.query("routes", query);
        return response.routes[shortName] as RoutesResult;
    }

    wsConnect(): Promise<void> {
        this.ws = new WebSocket(this.wsUrl);
        let wsHeartbeatInterval: number;

        this.ws.addEventListener("open", () => {
            this.resolveWhenWsConnect();

            for (const shortName of this.subscriptions.values()) {
                this.subscribe(shortName);
            }

            // send a heartbeat every 5 seconds
            wsHeartbeatInterval = setInterval(() => {
                this.ws.send(JSON.stringify({ route: "ping" }));
            }, 5000);
        });

        this.ws.addEventListener("close", ev => {
            if (!ev.wasClean) {
                console.warn("WebSocket closed", ev);
            }
            clearInterval(wsHeartbeatInterval);
            setTimeout(() => this.wsConnect(), 500);
        });

        this.ws.addEventListener("message", ev => {
            const data = JSON.parse(ev.data);
            if (this._onMessage === null) return;
            if (!data.status || !data.route) return;
            this._onMessage(data as Record<string, any>);
        });

        return this.promiseWsConnect;
    }

    subscribe(shortName: string): void {
        this.subscriptions.add(shortName);
        this.ws.send(JSON.stringify({
            route: "subscribe",
            shortName,
        }));
    }

    unsubscribe(shortName: string): void {
        this.subscriptions.delete(shortName);
        this.ws.send(JSON.stringify({
            route: "unsubscribe",
            shortName,
        }));
    }

    onMessage(listener: (data: Record<string, any>) => void): void {
        this._onMessage = listener;
    }
}

export default new Api();
