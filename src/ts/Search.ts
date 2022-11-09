import { api } from "./Api";
import State from "./State";
import Render from "./Render";

class Search {
    routes: SearchRoute[];

    state: State;

    $search: HTMLInputElement;

    $dropdown: HTMLElement;

    constructor(state: State, $search: HTMLInputElement, $dropdown: HTMLElement) {
        this.state = state;
        this.$search = $search;
        this.$dropdown = $dropdown;

        $search.addEventListener("input", () => {
            this.search($search.value);
        });

        $search.addEventListener("keyup", ev => {
            if (ev.key === "Escape") {
                this.clear();
            }
            if (ev.key === "Enter") {
                const $topResult = $dropdown.firstChild as HTMLElement;
                if ($topResult !== null) {
                    $topResult.click();
                    this.clear();
                }
            }
        });
    }

    async load(): Promise<void> {
        const REGEX_WORD = /[a-z]+/g;
        const REGEX_TWO_DIGITS = /^\d\d\D?$/;

        const routes = await api.queryRoutes();

        this.routes = [...routes.values()].map(r => {
            const shortNameLower = r.shortName.toLowerCase();
            const longNameLower = r.longName.toLowerCase();
            const longNameWords = [];

            let m;
            do {
                m = REGEX_WORD.exec(longNameLower);
                if (m && !["to", "via"].includes(m[0])) {
                    longNameWords.push(m[0]);
                }
            } while (m);

            return {
                type: r.type,
                shortName: r.shortName,
                shortNameLower,
                longName: r.longName,
                longNameLower,
                longNameWords,
            };
        });

        this.routes.sort((a, b) => {
            /*
             * Sort by route number ascending (two digit number first)
             * Then sort alphabetically, numbers first
             */
            const aInt = Number.parseInt(a.shortName, 10);
            const bInt = Number.parseInt(b.shortName, 10);
            if (aInt && bInt) {
                const aTwoDigits = REGEX_TWO_DIGITS.test(a.shortName);
                const bTwoDigits = REGEX_TWO_DIGITS.test(b.shortName);
                if (aTwoDigits !== bTwoDigits) {
                    return Number(bTwoDigits) - Number(aTwoDigits);
                }
                return aInt - bInt;
            }
            return a.shortName < b.shortName ? -1 : 1;
        });
    }

    render(routes: SearchRoute[]): void {
        Render.renderFilterDropdown(this.$dropdown, routes, routeData => {
            this.clear();
            this.state.activateRoute(routeData);
        });
    }

    clear(): void {
        this.render([]);
        this.$search.value = "";
        this.$search.blur();
    }

    search(query_: string): void {
        const query = query_.toLowerCase();

        if (query === "") {
            this.render([]);
            return;
        }

        this.routes.forEach(r => {
            let filterWeight = 0;
            if (r.shortNameLower === query) {
                filterWeight += 50;
            }
            else if (r.shortNameLower.startsWith(query)) {
                filterWeight += 25;
            }
            if (r.longNameLower.includes(query)) {
                filterWeight += 5;
            }
            r.longNameWords.forEach(word => {
                if (word.startsWith(query)) {
                    filterWeight += 5;
                }
                else if (word.includes(query)) {
                    filterWeight += 1;
                }
            });

            // eslint-disable-next-line no-param-reassign
            r.filterWeight = filterWeight;
        });

        const filtered = this.routes.filter(r => r.filterWeight && !this.state.isActive(r));
        filtered.sort((a, b) => b.filterWeight - a.filterWeight);
        this.render(filtered);
    }
}

export default Search;
