import Setting, { BooleanSetting, StringSetting, NumberSetting } from "./Setting";

function getInput(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
}

const SETTINGS = [
    new BooleanSetting("darkMode", getInput("sw-dark-mode")),
    new BooleanSetting("hideAbout", getInput("sw-hide-about")),
];

let instance: Settings = null;

class Settings {
    private settings = new Map<string, Setting>();

    private constructor() {
        SETTINGS.forEach(s => this.settings.set(s.name, s));
    }

    static getInstance(): Settings {
        if (instance == null) {
            instance = new Settings();
        }
        return instance;
    }

    import(newSettings: Record<string, any>): void {
        Object.entries(newSettings).forEach(([k, v]) => {
            const s = this.settings.get(k);
            if (s != null) {
                s.value = v;
                s.triggerChange();
            }
        });
    }

    toJSON(): Record<string, any> {
        return Object.fromEntries([...this.settings.values()].map(s => [s.name, s.value]));
    }

    getBool(name: string): boolean {
        const setting = this.settings.get(name);
        if (!(setting instanceof BooleanSetting)) {
            throw Error(`Cannot call getBool on a setting of type ${setting.constructor.name}`);
        }
        return setting && setting.value;
    }

    getStr(name: string): string {
        const setting = this.settings.get(name);
        if (!(setting instanceof StringSetting)) {
            throw Error(`Cannot call getStr on a setting of type ${setting.constructor.name}`);
        }
        return setting && setting.value;
    }

    getNum(name: string): number {
        const setting = this.settings.get(name);
        if (!(setting instanceof NumberSetting)) {
            throw Error(`Cannot call getNum on a setting of type ${setting.constructor.name}`);
        }
        return setting && setting.value;
    }

    getSetting(name: string): Setting {
        return this.settings.get(name);
    }

    getNames(): string[] {
        return [...this.settings.keys()];
    }

    addChangeListener(name: string, l: (value: any, name: string) => void): void {
        const setting = this.settings.get(name);
        if (setting != null) {
            setting.addChangeListener(l);
        }
    }

    removeChangeListener(name: string, l: (value: any, name: string) => void): void {
        const setting = this.settings.get(name);
        if (setting != null) {
            setting.removeChangeListener(l);
        }
    }
}

export default Settings;

export const settings = Settings.getInstance();
