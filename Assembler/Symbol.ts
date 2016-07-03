///<reference path="Section.ts"/>

module ARM.Assembler {
    /**
     * Represents an entry in the assembler's symbol table.
     */
    export class Symbol {
        private name: string;
        private value: any = null;
        private label = false;
        private section: Section = null;

        /**
         * Gets the name of the symbol.
         * 
         * @return {string}
         *  The name of the symbol.
         */
        get Name() {
            return this.name;
        }

        /**
         * Gets the value of the symbol.
         * 
         * @return {any}
         *  The value of the symbol.
         */
        get Value() {
            return this.value;
        }

        /**
         * Sets the value of the symbol.
         * 
         * @param {any} value
         *  The value to set the symbol to.
         */
        set Value(value: any) {
            this.value = value;
        }

        /**
         * Gets whether the symbol is a label.
         * 
         * @return {boolean}
         *  true if the symbol is a label definition; otherwise false.
         */
        get Label() {
            return this.label;
        }

        /**
         * Gets the section in which the symbol is defined.
         * 
         * @returns {Section}
         *  The section in which the symbol is defined. If the symbol is not a label, this
         *  method returns null.
         */
        get Section() {
            return this.section;
        }

        /**
         * Initializes a new instance of the Symbol class with the specified parameters.
         * 
         * @param {string} name
         *  The name of the symbol.
         * @param {any} value
         *  The value of the symbol.
         * @param {boolean} label
         *  true if the symbol being created is a label definition; otherwise false.
         * @param {Section} section
         *  The section the symbol is being defined in; This parameter is ignored if the symbol
         *  is not a label.
         */
        constructor(name: string, value: any, label: boolean, section: Section = null) {
            this.name = name;
            this.value = value;
            this.label = label;
            this.section = section;
        }
    }
}