import { LiveVehicle } from "./types";
import VehicleMarker from "./VehicleMarker";
import Api from "./Api";
import Render from "./Render";

interface RouteOptions {
    map: google.maps.Map;
    type: Route["type"];
    color: string;
    active?: boolean;
    shortName: Route["shortName"];
}

class Route {
    map: google.maps.Map;

    type: "bus" | "rail" | "ferry";

    color: string;

    active: boolean;

    longName: string;

    shortName: string;

    polylines: google.maps.Polyline[];

    vehicleMarkers: Map<string, VehicleMarker>;

    constructor({ map, type, color, shortName }: RouteOptions) {
        this.map = map;
        this.type = type;
        this.color = color;
        this.shortName = shortName;

        this.active = false;
        this.longName = null;
        this.polylines = null;
        this.vehicleMarkers = new Map();
    }

    generateMarkerIcon(directionId: LiveVehicle["directionId"], colorOverride?: string): google.maps.Icon {
        const fill = colorOverride || this.color;
        const dotFill = directionId === 0 ? "#000" : "#FFF";
        return Render.createMarkerIcon({ fill, dotFill });
    }

    showVehicle({ vehicleId, position, lastUpdated, directionId }: LiveVehicle): void {
        let marker = this.vehicleMarkers.get(vehicleId);
        if (marker === undefined) {
            marker = new VehicleMarker({ map: this.map });
            this.vehicleMarkers.set(vehicleId, marker);

            marker.interval = setInterval(() => {
            // delete marker after no update for 90 seconds
                const now = Math.floor((new Date()).getTime() / 1000);
                if (marker.lastUpdated < now - 90) {
                    marker.setMap(null);
                    clearInterval(marker.interval);
                    this.vehicleMarkers.delete(vehicleId);
                }
                // make marker gray after no update for 30 seconds
                else if (marker.lastUpdated < now - 30) {
                    marker.setIcon(this.generateMarkerIcon(directionId, "gray"));
                }
            }, 1000 + Math.floor(Math.random() * 200));
        }

        marker.setPosition(position);
        marker.setIcon(this.generateMarkerIcon(directionId));
        marker.lastUpdated = lastUpdated;
        marker.directionId = directionId;
    }

    setColor(color: string): void {
        this.color = color;
        if (this.polylines) {
            this.polylines[2].setOptions({ strokeColor: color });
            this.polylines[3].setOptions({ strokeColor: color });
        }
        for (const m of this.vehicleMarkers.values()) {
            m.setIcon(this.generateMarkerIcon(m.directionId));
        }
    }

    async activate(): Promise<void> {
        if (this.active) {
            return;
        }
        this.active = true;
        Api.subscribe(this.shortName);

        const [
            { longName, polylines },
            { vehicles },
        ] = await Promise.all([
            Api.queryRoute(this.shortName, ["longName", "polylines"]),
            Api.queryRoute(this.shortName, ["vehicles"]),
        ]);

        this.longName = longName;

        const { map } = this;
        const strokeOpacity = 0.7;
        this.polylines = [
            // background line, so the path isn't affected by the map colour
            new google.maps.Polyline({ map, path: polylines[0], strokeColor: "black" }),
            new google.maps.Polyline({ map, path: polylines[1], strokeColor: "white" }),

            // route line, semi-transparent so it's obvious when they overlap
            new google.maps.Polyline({ map, path: polylines[0], strokeColor: this.color, strokeOpacity, zIndex: 1 }),
            new google.maps.Polyline({ map, path: polylines[1], strokeColor: this.color, strokeOpacity, zIndex: 2 }),
        ];

        Object.values(vehicles).map(v => this.showVehicle(v));
    }

    deactivate(): void {
        if (!this.active) {
            return;
        }
        this.active = false;
        Api.unsubscribe(this.shortName);

        for (const polyline of this.polylines) {
            polyline.setMap(null);
        }

        for (const marker of this.vehicleMarkers.values()) {
            marker.setMap(null);
        }
    }
}

export default Route;
