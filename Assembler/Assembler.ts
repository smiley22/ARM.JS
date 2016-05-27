///<reference path="Util.ts"/>

module ARM.Assembler {
    /**
     * Implements a GNU-like assembler for the ARMv4T instruction set architecture.
     */
    export class Assembler {

        /**
         * Gets the bitmask used in instruction words to encode the specified conditon-code.
         * 
         * @param {string} conditionCode
         *  The condition-code whose bitmask to lookup.
         * @return {number}
         *  The bitmask used to encode the specified condition-code.
         * @remarks
         *  See 'ARM7TDMI-S Data Sheet, 4.2 Condition Fields' for a list and explanation of
         *  condition-codes supported by the ARMv4T architecture.
         */
        private ConditionMask(conditionCode: string): number {
            var m = {
                'EQ': 0x00, 'NE': 0x01, 'CS': 0x02, 'CC': 0x03, 'MI': 0x04,
                'PL': 0x05, 'VS': 0x06, 'VC': 0x07, 'HI': 0x08, 'LS': 0x09,
                'GE': 0x0A, 'LT': 0x0B, 'GT': 0x0C, 'LE': 0x0D, 'AL': 0x0E
            };
            // Default: always execute
            if (!conditionCode)
                return m['AL'];
            if (typeof (m[conditionCode]) == 'undefined')
                throw new Error(`Invalid condition code ${conditionCode}`);
            return m[conditionCode];
        }

        /**
         * Assembles a 32-bit ARMv4 instruction from the specified data.
         * 
         * @param data
         *  An object containing the mnemonic, operands and possible operation flags, if
         *  applicable for the respective instruction.
         * @return {number}
         *  A 32-bit value representing the respective ARMv4 instruction constructed from the
         *  specified data.
         * @throw Error
         *  The mnemonic contained in the specified data object is not a valid mnemonic for the
         *  ARMv4 instruction set architecture, or any of the operands or operation flags are
         *  invalid.
         */
        private BuildInstruction(data: { Mnemonic: string }): number {
            var lookup = [
                [['BX'], 0],
                [['B', 'BL'], 1],
                [['AND', 'EOR', 'SUB', 'RSB', 'ADD', 'ADC',
                    'SBC', 'RSC', 'ORR', 'BIC', 'MOV', 'MVN'], 2],
                [['MRS'], 3],
                [['MSR'], 4],
                [['MUL', 'MLA'], 5],
                [['UMULL', 'UMLAL', 'SMULL', 'SMLAL'], 6],
                [['LDR', 'STR'], 7],
                /* */
                [['LDM', 'STM'], 9],
                [['SWP'], 10],
                [['SWI'], 11],
                [['CDP'], 12],
                [['LDC', 'STC'], 13],
                [['MRC', 'MCR'], 14],
                [['PUSH', 'POP'], 15],
                [['LSL', 'LSR', 'ASR', 'ROR'], 16],
                [['RRX'], 17],
                [['NOP'], 18],
                [['CMP', 'CMN', 'TEQ', 'TST'], 19]
            ];
            for (var entry of lookup) {
                if ((entry[0] as string[]).indexOf(data.Mnemonic) >= 0)
                    return this[`BuildInstruction_${entry[1]}`](data);
            }
            throw new SyntaxError(`Invalid Mnemonic ${data.Mnemonic}`);
        }

         /**
          * Builds an ARM instruction word for the 'BX' instruction.
          * 
          * @param data
          *  An object containing parameters and operation flags for the instruction.
          * @return {number}
          *  A 32-bit ARM instruction word.
          */
        private BuildInstruction_0(data) {
            var BX_Mask = 0x12FFF10;
            var Cm = this.ConditionMask(data.Condition);
            var Rn = parseInt(data.Rn.substr(1));
            return ((Cm << 28) | BX_Mask | Rn);
        }
    }
}