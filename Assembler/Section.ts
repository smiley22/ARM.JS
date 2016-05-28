///<reference path="Util.ts"/>

module ARM.Assembler {
    /**
     * Represents a section into which code is assembled.
     */
    export class Section {
        private name;
        private size = 0;
        private pos = 0;

        get Name() {
            return this.name;
        }

        get Size() {
            return this.size;
        }

        get Position() {
            return this.pos;
        }

        constructor(name: string) {
            this.name = name;
        }
    }
}