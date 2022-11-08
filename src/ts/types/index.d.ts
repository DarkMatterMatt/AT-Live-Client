type TransitType = "bus" | "rail" | "ferry" | "mixed";

type MarkerType = "marker" | "pointyCircle";

interface LatLng {
    lat: number;
    lng: number;
}

interface SearchRoute {
    type?: TransitType;
    shortName: string;
    shortNameLower?: string;
    longName?: string;
    longNameLower?: string;
    longNameWords?: string[];
    filterWeight?: number;
    $searchResult?: HTMLDivElement;
    $activeRoute?: HTMLDivElement;
}
