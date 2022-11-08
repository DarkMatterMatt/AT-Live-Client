import HtmlMarkerView from "./HtmlMarkerView";
import { IRoute } from "./Route";
import VehicleMarker from "./VehicleMarker";

export interface MultiRouteOptions {
    routes: IRoute[];
    wildcardString: string;
}

class MultiRoute implements IRoute {
    private routes: IRoute[];

    private wildcardString: string;

    constructor(o: MultiRouteOptions) {
        if (o.routes.length === 0) {
            throw new Error("MultiRoute must represent at least one route.");
        }
        this.routes = o.routes;
        this.wildcardString = o.wildcardString;
    }

    public async activate(): Promise<void> {
        this.routes.forEach(r => r.activate());
    }

    public deactivate(): void {
        this.routes.forEach(r => r.deactivate());
    }

    public getColor(): string {
        return this.routes[0].getColor();
    }

    public getLongDescription(): string {
        if (this.routes.length === 1) {
            return this.routes[0].getLongDescription();
        }
        return this.routes.map(r => r.getShortDescription()).join(", ");
    }

    public getShortDescription(): string {
        if (this.routes.length === 1) {
            return this.routes[0].getShortDescription();
        }
        return this.wildcardString;
    }

    public getShortNames(): string[] {
        return this.routes.flatMap(r => r.getShortNames());
    }

    public getType(): TransitType {
        const types = new Set<TransitType>();
        this.routes.forEach(r => types.add(r.getType()));
        return types.size > 1 ? "mixed" : [...types.values()][0];
    }

    public getWildcardString(): string {
        return this.wildcardString;
    }

    public isActive(): boolean {
        return this.routes[0].isActive();
    }

    public async loadPolylines(): Promise<void> {
        this.routes.forEach(r => r.loadPolylines());
    }

    public async loadVehicles(): Promise<void> {
        this.routes.forEach(r => r.loadVehicles());
    }

    public removeVehicle(markerOrId: string | VehicleMarker): void {
        this.routes.forEach(r => r.removeVehicle(markerOrId));
    }

    public setAnimatePosition(animate: boolean): void {
        this.routes.forEach(r => r.setAnimatePosition(animate));
    }

    public setColor(color: string): void {
        this.routes.forEach(r => r.setColor(color));
    }

    public setMap(map: google.maps.Map<Element>): void {
        this.routes.forEach(r => r.setMap(map));
    }

    public setMarkerIconType(type: MarkerType): void {
        this.routes.forEach(r => r.setMarkerIconType(type));
    }

    public setMarkerView(markerView: HtmlMarkerView): void {
        this.routes.forEach(r => r.setMarkerView(markerView));
    }

    public setShowTransitRoutes(show: boolean): void {
        this.routes.forEach(r => r.setShowTransitRoutes(show));
    }

    public showVehicle(v: LiveVehicle): void {
        this.routes.find(r => r.getShortNames().includes(v.shortName)).showVehicle(v);
    }
}

export default MultiRoute;
