﻿///<reference path="Litpool.ts"/>
///<reference path="Parser.ts"/>
///<reference path="Section.ts"/>
///<reference path="Symbol.ts"/>

module ARM.Assembler {
    /**
     * Implements a GNU-like assembler for the ARMv4T instruction set architecture.
     */
    export class Assembler {
        /**
         * The currently selected section.
         */
        private section: Section;

        static Assemble(source: string, layout: {}) {
            var asm = new Assembler(),
                lines = asm.GetSourceLines(source);

            asm.Pass_0(lines);

        }

        /**
         * Takes the contents of a formatted source-code file as input and returns an array of
         * lines of assembly code, labels and/or directives.
         * 
         * @param {string} source
         *  The contents a source-code file containing assembly code.
         * @return {string}
         *  An array of of lines of assembly code.
         */
        private GetSourceLines(source: string) {
            var lines = new Array<string>();
            for (let line of Util.StripComments(source)) {
                // Trim all lines and skip empty ones.
                if ((line = line.replace(/\t/g, ' ').trim()) != '')
                    lines.push(line);
            }
            return lines;
        }

        private Pass_0(lines: string[]) {
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                // Label definition
                if (line.match(/^(.*):(.*)$/)) {
                    // Add entry to symbol table.

                    // Remove label from line and fall through.
                    line = line[i] = RegExp.$2.trim();
                    if (line == '')
                        continue;
                }

                // Assembler directive
                if (line.match(/^\.(\w+)\s*(.*)/)) {
                    if (this.ProcessDirective_0(RegExp.$1, RegExp.$2))
                        lines[i] = ''; // Remove directive from output of pass 0.
                } else {
                    // Assume it's an instruction. All instructions are 32-bit long.
                    this.section.Size += 4;
                }
            }
            return lines.filter(s => s != '');
        }

        /**
         * Determines whether the specified string is a valid directive understood by the
         * assembler.
         * 
         * @param {string} s
         *  The string to determine whether it's a valid directive.
         * @return {boolean}
         *  true if the specified string is a valid assembler directive; otherwise false.
         */
        private IsValidDirective(s: string) {
            let directives = [
                'ARM', 'THUMB', 'CODE32', 'CODE16', 'FORCE_THUMB', 'THUMB_FUNC',
                'LTORG', 'EQU', 'SET', 'BYTE', 'WORD', 'HWORD', '2BYTE', '4BYTE',
                'ASCII', 'ASCIZ', 'DATA', 'TEXT', 'END', 'EXTERN', 'GLOBAL',
                'INCLUDE', 'SKIP', 'REG', 'ALIGN', 'SECTION', 'FILE', 'RODATA',
                'BSS', 'FUNC', 'ENDFUNC'
            ];
            return directives.indexOf(s) >= 0;
        }

        private ProcessDirective_0(directive: string, params: string) {
            directive = directive.toUpperCase().trim();
            if (!this.IsValidDirective(directive))
                throw new Error(`Unknown assembler directive: ${directive}`);
            switch(directive) {
                case 'SECTION':
                    break;
                case 'DATA':
                case 'TEXT':
                    break;
                case 'RODATA':
                case 'BSS':
                    break;
                case 'EQU':
                case 'SET':
                    return true;
            }

            return false;
        }

        private Pass_1(lines: string[]) {

        }

        private ProcessDirective_1(directive: string, params: string) {
            
        }

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
            var bxMask = 0x12FFF10,
                cm = this.ConditionMask(data.Condition),
                rn = parseInt(data.Rn.substr(1));
            return (cm << 28) | bxMask | rn;
        }

        /**
         * Builds an ARM instruction word for the 'B' and 'BL' instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_1(data) {
            var l = data.Mnemonic == 'BL' ? 1 : 0,
                mask = 0xA000000,
                cm = this.ConditionMask(data.Condition),
                // Branch offsets are relative with respect to the position of
                // the instruction.
                relOffset = data.Offset - this.section.Position - 8,
                of = (relOffset >>> 2) & 0xFFFFFF;
            return (cm << 28) | (l << 24) | mask | of;
        }

        /**
         * Builds an ARM instruction word for the data-processing instructions
         * (AND, ADD, MOV, etc.)
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_2(data) {
            var opcodes = {
                'AND': 0, 'EOR': 1, 'SUB': 2, 'RSB': 3, 'ADD': 4, 'ADC': 5,
                'SBC': 6, 'RSC': 7, 'ORR': 12, 'MOV': 13, 'BIC': 14, 'MVN': 15
            },
                cm = this.ConditionMask(data.Condition),
                s = data.S ? 1 : 0,
                i = data.Immediate ? 1 : 0,
                rd = parseInt(data.Rd.substr(1)),
                rn = data.Rn ? parseInt(data.Rn.substr(1)) : 0, // some operations igore Rn field
                op2: number;
            if (i) {
                if (data.Mnemonic == 'MOV' && data.Op2.Negative)
                    data.Mnemonic = 'MVN';
                else if (data.Mnemonic == 'MVN' && !data.Op2.Negative)
                    data.Mnemonic = 'MOV';
                op2 = (data.Op2.Rotate << 8) | data.Op2.Immediate;
            } else {
                var stypes = { 'LSL': 0, 'LSR': 1, 'ASL': 0, 'ASR': 2, 'ROR': 3 };
                var sf = 0;
                if (data.Shift && data.ShiftOp) {
                    var st = stypes[data.ShiftOp];
                    if (Util.IsRegister(data.Shift))
                        sf = (parseInt(data.Shift.substr(1)) << 4) | (st << 1) | (1);
                    else
                        sf = (data.Shift << 3) | (st << 1);
                }
                op2 = (sf << 4) | parseInt(data.Op2.substr(1));
            }
            var opc = opcodes[data.Mnemonic];
            // TST, TEQ, CMP, CMN always MUST have the S flag set.
            if (opc > 7 && opc < 12)
                s = 1;
            return (cm << 28) | (i << 25) | (opc << 21) | (s << 20) | (rn << 16) |
                (rd << 12) | (op2);
        }

        /**
         * Builds an ARM instruction word for the 'MRS' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_3(data) {
            var cm = this.ConditionMask(data.Condition),
                rd = parseInt(data.Rd.substr(1)),
                p = (data.P == 'CPSR' || data.P == 'CPSR_ALL') ? 0 : 1,
                mask = 0x10F0000;
            return (cm << 28) | (p << 22) | (rd << 12) | mask;
        }

        /**
         * Builds an ARM instruction word for the 'MSR' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_4(data) {
            var cm = this.ConditionMask(data.Condition),
                r: number;
            // flag bits only
            if (data.P == 'CPSR_FLG' || data.P == 'SPSR_FLG') {
                let i = Util.IsRegister(data.Op2) ? 0 : 1,
                    p = data.P == 'CPSR_FLG' ? 0 : 1,
                    s: number,
                    mask = 0x128F000;
                if (!i)
                    s = parseInt(data.Op2.substr(1));
                else {
                    // ARM ARM7TDMI-S Data Sheet 4.6.4
                    // TODO: Wie wird 32-Bit Konstante erzeugt mit 4 Shiftbits und 8 bit immediate?
                    throw new Error('Not implemented');
                }
                r = (cm << 28) | (i << 25) | (p << 22) | mask | s;
            } else {
                let p = (data.P == 'CPSR' || data.P == 'CPSR_ALL') ? 0 : 1,
                    rm = parseInt(data.Op2.substr(1)),
                    mask = 0x129F000;
                r = (cm << 28) | (p << 22) | mask | rm;
            }
            return r;
        }

        /**
         * Builds an ARM instruction word for the 'MUL' and 'MLA' instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_5(data) {
            var cm = this.ConditionMask(data.Condition),
                a = data.Mnemonic == 'MLA' ? 1 : 0,
                s = data.S ? 1 : 0,
                rd = parseInt(data.Op1.substr(1)),
                rs = parseInt(data.Op2.substr(1)),
                rm = parseInt(data.Op3.substr(1)),
                rn = a ? parseInt(data.Op4.substr(1)) : 0,
                mask = 0x90;
            return (cm << 28) | (a << 21) | (s << 20) | (rd << 16) | (rn << 12) |
                (rs << 8) | mask | rm;
        }

        /**
         * Builds an ARM instruction word for the 'UMULL', 'MLAL', 'SMULL' and
         * 'SMLAL' instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_6(data) {
            var cm = this.ConditionMask(data.Condition),
                rdLo = parseInt(data.Op1.substr(1)),
                rdHi = parseInt(data.Op2.substr(2)),
                rm = parseInt(data.Op3.substr(1)),
                rs = parseInt(data.Op4.substr(1)),
                u = (data.Mnemonic == 'UMULL' || data.Mnemonic == 'UMLAL') ? 1 : 0,
                a = (data.Mnemonic == 'UMLAL' || data.Mnemonic == 'SMLAL') ? 1 : 0,
                s = data.S ? 1 : 0,
                mask = 0x800090;
            return (cm << 28) | (u << 22) | (a << 21) | (s << 20) | (rdHi << 16) |
                (rdLo << 12) | (rs << 8) | mask | rm;
        }

        /**
         * Builds an ARM instruction word for the 'LDR' and 'STR' instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_7(data) {
            // TODO
            throw new Error('Not implemented');
        }

        /**
         * Builds an ARM instruction word for the 'LDR' and 'STR' signed-byte and half-word
         * instruction variants.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_8(data) {
            var cm = this.ConditionMask(data.Condition),
                // TODO: Verify method
                // var mask = 0x90;
                rd = parseInt(data.Rd.substr(1)),
                rn = parseInt(data.Source.substr(1)),
                l = data.Mnemonic == 'LDR' ? 1 : 0,
                p = data.Type == 'Pre' ? 1 : 0,
                w = data.Writeback ? 1 : 0,
                u = data.Subtract ? 0 : 1,
                i = data.Immediate ? 1 : 0,
                modes = { 'H': 1, 'SB': 2, 'SH': 3 },
                m = modes[data.Mode],
                loNibble = 0,
                hiNibble = 0;
            if (i == 0 && data.Offset)
                loNibble = parseInt(data.Offset.substr(1));
            else if (data.Offset) {
                // Offset is unsigned 8-bit immediate split into two nibbles.
                loNibble = data.Offset & 0xF;
                hiNibble = (data.Offset >> 4) & 0xF;
            }
            return (cm << 28) | (p << 24) | (u << 23) | (w << 21) | (l << 20) |
                (rn << 16) | (rd << 12) | (hiNibble << 8) | (m << 5) | loNibble;
        }

        /**
         * Builds an ARM instruction word for the 'LDM' and 'STM' instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_9(data) {
            var cm = this.ConditionMask(data.Condition),
                mask = 0x8000000,
                rn = parseInt(data.Rn.substr(1)),
                w = data.Writeback ? 1 : 0,
                s = data.S ? 1 : 0,
                modes = {
                    'LDMED': [1, 1, 1], 'LDMFD': [1, 0, 1], 'LDMEA': [1, 1, 0],
                    'LDMFA': [1, 0, 0], 'LDMIB': [1, 1, 1], 'LDMIA': [1, 0, 1],
                    'LDMDB': [1, 1, 0], 'LDMDA': [1, 0, 0],
                    'STMFA': [0, 1, 1], 'STMEA': [0, 0, 1], 'STMFD': [0, 1, 0],
                    'STMED': [0, 0, 0], 'STMIB': [0, 1, 1], 'STMIA': [0, 0, 1],
                    'STMDB': [0, 1, 0], 'STMDA': [0, 0, 0]
                },
                m = modes[data.Mnemonic + data.Mode],
                l = m[0],
                p = m[1],
                u = m[2],
                rList = 0;
            for (let i = 0; i < data.RList.length; i++) {
                let reg = parseInt(data.RList[i].substr(1));
                rList |= (1 << reg);
            }
            return (cm << 28) | mask | (p << 24) | (u << 23) | (s << 22) | (w << 21) |
                (l << 20) | (rn << 16) | rList;
        }

        /**
         * Builds an ARM instruction word for the 'SWP' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_10(data) {
            var cm = this.ConditionMask(data.Condition),
                mask = 0x1000090,
                b = data.B ? 1 : 0,
                rd = parseInt(data.Op1.substr(1)),
                rm = parseInt(data.Op2.substr(1)),
                rn = parseInt(data.Op3.substr(1));
            return (cm << 28) | mask | (b << 22) | (rn << 16) | (rd << 12) | rm;
        }

        /**
         * Builds an ARM instruction word for the 'SWI' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_11(data) {
            var cm = this.ConditionMask(data.Condition),
                mask = 0xF000000;
            return (cm << 28) | mask | data.Offset;
        }

        /**
         * Builds an ARM instruction word for the 'CDP' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_12(data) {
            var _cm = this.ConditionMask(data.Condition),
                mask = 0xE000000,
                cn = parseInt(data.Cn.substr(1)),
                cm = parseInt(data.Cm.substr(1)),
                cd = parseInt(data.Cd.substr(1)),
                type = data.CPType || 0;
            return (_cm << 28) | mask | (data.CPOpc << 20) | (cn << 16) | (cd << 12) |
                (data.CP << 8) | (type << 5) | cm;
        }

        /**
         * Builds an ARM instruction word for the 'LDC' and 'STC' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_13(data) {
            var cm = this.ConditionMask(data.Condition),
                mask = 0xC000000,
                n = data.L ? 1 : 0,
                cd = parseInt(data.Cd.substr(1)),
                rn = parseInt(data.Source.substr(1)),
                l = data.Mnemonic == 'LDC' ? 1 : 0,
                p = data.Type == 'Pre' ? 1 : 0,
                w = data.Writeback ? 1 : 0,
                u = data.Subtract ? 0 : 1;
            return (cm << 28) | mask | (p << 24) | (u << 23) | (n << 22) | (w << 21) |
                (l << 20) | (rn << 16) | (cd << 12) | (data.CP << 8) | data.Offset;
        }

        /**
         * Builds an ARM instruction word for the 'MRC' and 'MCR' instruction.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_14(data) {
            var _cm = this.ConditionMask(data.Condition),
                mask = 0xE000010,
                l = data.Mnemonic == 'MRC' ? 1 : 0,
                rd = parseInt(data.Rd.substr(1)),
                cn = parseInt(data.Cn.substr(1)),
                cm = parseInt(data.Cm.substr(1)),
                type = data.CPType || 0;
            return (_cm << 28) | mask | (data.CPOpc << 21) | (l << 20) | (cn << 16) |
                (rd << 12) | (data.CP << 8) | (type << 5) | cm;
        }

        /**
         * Builds an ARM instruction word for the 'PUSH' and 'POP' pseudo-instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_15(data) {
            if (data.Mnemonic == 'PUSH')
                data.Mnemonic = 'STM';
            else
                data.Mnemonic = 'LDM';
            return this.BuildInstruction_9(data);
        }

        /**
         * Builds an ARM instruction word for the 'LSL', 'LSR', 'ASR' and 'ROR'
         * pseudo-instructions which expand to MOV instructions with rotations and no other
         * operation.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_16(data) {
            data['ShiftOp'] = data.Mnemonic;
            data.Mnemonic = 'MOV';
            return this.BuildInstruction_2(data);
        }

        /**
         * Builds an ARM instruction word for the 'RRX' pseudo-instruction which expands
         * to a MOV instruction with RRX rotation and no other operation.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_17(data) {
            data.Rrx = true;
            data.Mnemonic = 'MOV';
            return this.BuildInstruction_2(data);
        }

        /**
         * Builds an ARM instruction word for the 'NOP' pseudo-instruction which expands
         * to a 'MOV R0, R0' operation.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_18(data) {
            return this.BuildInstruction_2({
                Mnemonic: 'MOV',
                Rd: 'R0',
                Op2: 'R0'
            });
        }

        /**
         * Builds an ARM instruction word for the 'CMP', 'CMN', 'TEQ' and 'TST'
         * data-processing instructions.
         * 
         * @param data
         *  An object containing parameters and operation flags for the instruction.
         * @return {number}
         *  A 32-bit ARM instruction word.
         */
        private BuildInstruction_19(data) {
            var opcodes = { 'TST': 8, 'TEQ': 9, 'CMP': 10, 'CMN': 11 },
                cm = this.ConditionMask(data.Condition),
                s = 1, // TST, TEQ, CMP, CMN always MUST have the S flag set.
                i = data.Immediate ? 1 : 0,
                rn = parseInt(data.Rn.substr(1)),
                rd = 0, // SBZ?
                op2: number;
            if (i) {
                op2 = (data.Op2.Rotate << 8) | data.Op2.Immediate;
            } else {
                var stypes = { 'LSL': 0, 'LSR': 1, 'ASL': 0, 'ASR': 2, 'ROR': 3 };
                var sf = 0;
                if (data.Shift && data.ShiftOp) {
                    var st = stypes[data.ShiftOp];
                    if (Util.IsRegister(data.Shift))
                        sf = (parseInt(data.Shift.substr(1)) << 4) | (st << 1) | (1);
                    else
                        sf = (data.Shift << 3) | (st << 1);
                }
                op2 = (sf << 4) | parseInt(data.Op2.substr(1));
            }
            var opc = opcodes[data.Mnemonic];
            return (cm << 28) | (i << 25) | (opc << 21) | (s << 20) | (rn << 16) |
                (rd << 12) | op2;
        }
    }
}