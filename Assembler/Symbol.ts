module ARM.Assembler {
    export class Symbol {
        private name: string;
        private value: any = null;
        private label = false;
        private section: Section = null;

        get Name() {
            return this.name;
        }

        get Value() {
            return this.value;
        }

        set Value(value: any) {
            this.value = value;
        }

        get Label() {
            return this.label;
        }

        constructor(name: string, value: any, label: boolean, section: Section = null) {
            this.name = name;
            this.value = value;
            this.label = label;
            this.section = section;
        }
    }


}