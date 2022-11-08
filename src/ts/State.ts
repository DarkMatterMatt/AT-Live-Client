import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { api } from "./Api";
import { isEmptyObject, localStorageEnabled, wildcardStringToRegex } from "./Helpers";
import HtmlMarkerView from "./HtmlMarkerView";
import MultiRoute from "./MultiRoute";
import Render from "./Render";
import Route, { IRoute } from "./Route";
import { settings } from "./Settings";

const STATE_VERSION = 2;

interface ParsedState {
    version: number;

    // routes: array of [shortName | wildcardString, active, color]
    routes: [string, boolean, string][];

    // map of <settingName, value>
    settings: Record<string, any>;
}

let instance: State = null;

class State {
    /** Is the user's first visit (i.e. user has never modified the default routes & settings). */
    private bIsFirstVisit: boolean;

    private map: google.maps.Map = null;

    private markerView: HtmlMarkerView;

    private routesByShortName = new Map<string, IRoute>();

    private $activeRoutes: HTMLElement = document.createElement("div");

    private constructor() {
        //
    }

    static getInstance(): State {
        if (instance == null) {
            instance = new State();
        }
        return instance;
    }

    static migrate(data: Record<string, any>): ParsedState & { isFirstVisit: boolean } {
        /* eslint-disable no-param-reassign */
        const version = data.version as number;

        // on first load, show route 25B and 70
        if (isEmptyObject(data)) {
            return {
                isFirstVisit: true,
                version: STATE_VERSION,
                routes: [
                    ["25+", true, "#9400D3"],
                    ["70", true, "#E67C13"],
                ],
                settings: {},
            };
        }

        if (version < 2) {
            // remove type from route
            (data.routes as [TransitType, string, boolean, string][]).forEach(r => r.splice(0, 1));
            data.settings = {};
        }

        return {
            isFirstVisit: false,
            version: STATE_VERSION,
            routes: data.routes,
            settings: data.settings,
        };
    }

    setMap(map: google.maps.Map): State {
        this.map = map;
        this.routesByShortName.forEach(r => r.setMap(map));
        return this;
    }

    setMarkerView(markerView: HtmlMarkerView): State {
        this.markerView = markerView;
        this.routesByShortName.forEach(r => r.setMarkerView(markerView));
        return this;
    }

    setActiveRoutesElem($new: HTMLElement): State {
        $new.append(...this.$activeRoutes.childNodes);
        this.$activeRoutes = $new;
        return this;
    }

    toJSON(onlyActive = false): ParsedState {
        const activeRoutes = [...this.routesByShortName.values()].filter(r => !onlyActive || r.isActive());

        // TODO: don't save routes that are part of a MultiRoute. but do save if the user manually added the route (?)
        //   so how do we differentiate between a automatically added route and a manually added route?

        const getDescriptor = (r: IRoute) => {
            if (r instanceof MultiRoute) {
                return r.getWildcardString();
            }
            return r.getShortNames()[0];
        };

        return {
            version: STATE_VERSION,
            routes: activeRoutes.map(r => [getDescriptor(r), r.isActive(), r.getColor()]),
            settings,
        };
    }

    save(): void {
        if (localStorageEnabled()) {
            localStorage.setItem("state", JSON.stringify(this));
            window.location.hash = "";
        }
        else {
            window.location.hash = compressToEncodedURIComponent(JSON.stringify(this.toJSON(true)));
        }
    }

    async loadRoutes(parsedRoutes: ParsedState["routes"]): Promise<void> {
        const routesDataRaw = await api.queryRoutes(null, ["shortName", "longName", "type"]);
        const routesData = new Map(Object.entries(routesDataRaw));
        const animateMarkerPosition = settings.getBool("animateMarkerPosition");
        const showTransitRoutes = settings.getBool("showTransitRoutes");
        const markerType = settings.getStr("markerType") as MarkerType;

        const createRoute = (shortName: string, color: string) => {
            const { longName, type } = routesData.get(shortName);

            return new Route({
                animateMarkerPosition,
                showTransitRoutes,
                shortName,
                longName,
                color,
                type,
                map: this.map,
                markerView: this.markerView,
                markerType,
            });
        };

        const activate = (route: IRoute) => {
            const $activeRoute = Render.createActiveRoute(
                {
                    type: route.getType(),
                    shortName: route.getShortDescription(),
                    longName: route.getLongDescription(),
                },
                route.getColor(),
                false,
                this.changeRouteColor.bind(this),
                this.deactivateRoute.bind(this)
            );
            this.$activeRoutes.appendChild($activeRoute);
            route.activate();
        };

        parsedRoutes.forEach(([descriptor, active, color]) => {
            const regex = wildcardStringToRegex(descriptor);

            const shortNames = [...routesData.keys()].filter(shortName => shortName.match(regex) != null);
            console.log(regex, shortNames);
            if (shortNames.length === 0) {
                return;
            }

            const routes = shortNames.map(s => createRoute(s, color));
            const route = new MultiRoute({ routes, wildcardString: descriptor });

            this.routesByShortName.set(route.getWildcardString(), route);
            routes.forEach(r => this.routesByShortName.set(r.getShortName(), r));

            if (active) {
                activate(route);
            }
        });
    }

    load(): void {
        // trim leading # off location.hash
        const hash = window.location.hash.replace(/^#/, "");

        let data;
        if (hash) {
            data = decompressFromEncodedURIComponent(hash);
        }
        if (!data && localStorageEnabled()) {
            data = localStorage.getItem("state");
        }
        const parsed = State.migrate(data ? JSON.parse(data) : {});
        this.bIsFirstVisit = parsed.isFirstVisit;

        settings.import(parsed.settings);
        settings.getNames().forEach(n => settings.addChangeListener(n, () => this.save(), false));

        // run async
        this.loadRoutes(parsed.routes);
    }

    // eslint-disable-next-line class-methods-use-this
    getNewColor(): string {
        return Render.getNewColor([...this.routesByShortName.values()].map(r => ({ color: r.getColor() })));
    }

    getRoutesByShortName(): Map<string, IRoute> {
        return this.routesByShortName;
    }

    isActive({ shortName }: SearchRoute): boolean {
        const route = this.routesByShortName.get(shortName);
        return route ? route.isActive() : false;
    }

    /** Is the user's first visit (i.e. user has never modified the default routes & settings). */
    isFirstVisit(): boolean {
        return this.bIsFirstVisit;
    }

    showVehicle(data: LiveVehicle): void {
        const route = this.routesByShortName.get(data.shortName);
        if (route === undefined) {
            console.log("Skipping vehicle update because the route does not exist", data);
            return;
        }
        route.showVehicle(data);
    }

    changeRouteColor({ shortName }: SearchRoute, color: string): void {
        const route = this.routesByShortName.get(shortName);
        if (route) {
            route.setColor(color);
        }
        this.save();
    }

    deactivateRoute({ shortName, $activeRoute }: SearchRoute): void {
        const route = this.routesByShortName.get(shortName);
        if (route !== undefined) {
            route.deactivate();
        }
        $activeRoute.remove();
        this.save();
    }

    async activateRoute({ shortName, longName, type }: SearchRoute): Promise<void> {
        let route = this.routesByShortName.get(shortName);
        let showPickr = false;
        if (route === undefined) {
            const animateMarkerPosition = settings.getBool("animateMarkerPosition");
            const showTransitRoutes = settings.getBool("showTransitRoutes");
            const markerType = settings.getStr("markerType") as MarkerType;
            showPickr = true;
            route = new Route({
                animateMarkerPosition,
                showTransitRoutes,
                shortName,
                longName,
                type,
                color: this.getNewColor(),
                map: this.map,
                markerView: this.markerView,
                markerType,
            });
            this.routesByShortName.set(shortName, route);
        }

        const $activeRoute = Render.createActiveRoute({ shortName, longName, type }, route.getColor(), showPickr,
            this.changeRouteColor.bind(this), this.deactivateRoute.bind(this));
        this.$activeRoutes.appendChild($activeRoute);

        await route.activate();
        this.save();
    }

    async loadRouteVehicles(shortName: string): Promise<void> {
        const route = this.routesByShortName.get(shortName);
        if (route === undefined) {
            console.error(`Could not reload vehicles for route: ${shortName}. Route is not in routesByShortName.`);
            return;
        }
        await route.loadVehicles();
    }

    async loadActiveRoutesVehicles(): Promise<void> {
        await Promise.all([...this.routesByShortName.values()]
            .filter(r => r.isActive())
            .flatMap(r => r.getShortNames().map(s => this.loadRouteVehicles(s))));
    }
}

export default State;

export const state = State.getInstance();
