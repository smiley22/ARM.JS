///<reference path="Util.ts"/>

module ARM.Assembler {
    /**
     * Implements methods for parsing various expressions, assembler directives, operands and
     * mnemonics.
     */
    export class Parser {
        /**
         * Operation codes implemented by the ARMv4T Architecture.
         *
         * @remarks
         *  See ARM7TDMI-S Data Sheet, Chapter 4 (ARM Instruction Set)
         */
        private static mnemonics = [
            'ADC', 'ADD', 'AND', 'B', 'BIC', 'BL', 'BX', 'CDP', 'CMN', 'CMP', 'EOR', 'LDC', 'LDM',
            'LDR', 'MCR', 'MLA', 'MOV', 'MRC', 'MRS', 'MSR', 'MUL', 'MVN', 'ORR', 'RSB', 'RSC',
            'SBC', 'STC', 'STM', 'STR', 'SUB', 'SWI', 'SWP', 'TEQ', 'TST', 'NOP', 'PUSH', 'POP',
            'UMULL', 'UMLAL', 'SMULL', 'SMLAL', 'LSL', 'LSR', 'ASR', 'ROR', 'RRX'
        ];

        /**
         * Condition codes supported by the ARMv4T Architecture.
         *
         * @remarks
         *  See ARM7TDMI-S Data Sheet, 4.2 Condition Fields
         */
        private static conditions = [
            'EQ', 'NE', 'CS', 'CC', 'MI', 'PL', 'VS', 'VC', 'HI', 'LS', 'GE', 'LT',
            'GT', 'LE', 'AL'
        ];

        /**
         * Suffixes each mnemonic can (or must) have. Mnemonics not listed, don't have any
         * suffixes.
         *
         * @remarks
         *  See ARM7TDMI-S Data Sheet, Chapter 4.0
         */
        private static suffixes = {
            'AND': [{ Suffix: 'S' }], 'EOR': [{ Suffix: 'S' }], 'SUB': [{ Suffix: 'S' }],
            'RSB': [{ Suffix: 'S' }], 'ADD': [{ Suffix: 'S' }], 'ADC': [{ Suffix: 'S' }],
            'SBC': [{ Suffix: 'S' }], 'RSC': [{ Suffix: 'S' }], 'ORR': [{ Suffix: 'S' }],
            'BIC': [{ Suffix: 'S' }], 'MUL': [{ Suffix: 'S' }], 'MLA': [{ Suffix: 'S' }],
            'MOV': [{ Suffix: 'S' }], 'MVN': [{ Suffix: 'S' }],
            'ASR': [{ Suffix: 'S' }], 'ROR': [{ Suffix: 'S' }], 'RRX': [{ Suffix: 'S' }],
            'SWP': [{ Suffix: 'B' }], 'LDC': [{ Suffix: 'L' }], 'STC': [{ Suffix: 'L' }],
            'LDR': [{ Suffix: 'BT|B|T|H|SH|SB', Name: 'Mode' }],
            'STR': [{ Suffix: 'BT|B|T|H', Name: 'Mode' }],
            'LDM': [{ Suffix: 'FD|ED|FA|EA|IA|IB|DA|DB', Required: true, Name: 'Mode' }],
            'STM': [{ Suffix: 'FD|ED|FA|EA|IA|IB|DA|DB', Required: true, Name: 'Mode' }],
            'UMULL': [{ Suffix: 'S' }], 'UMLAL': [{ Suffix: 'S' }], 'SMULL': [{ Suffix: 'S' }],
            'SMLAL': [{ Suffix: 'S' }], 'LSL': [{ Suffix: 'S' }], 'LSR': [{ Suffix: 'S' }]
        };

        private symbolLookup: (symbol: string) => any;

        constructor(symbolLookup: (symbol: string) => any) {
            this.symbolLookup = symbolLookup;
        }

        /**
         * Parses the mnemonic and condition field from the specified string.
         * 
         * @param {string} s
         *  The string to parse mnemonic and condition field from.
         * @return
         *  An array composed of an object containing the parsed fields at index 0 and the
         *  remainder of the instruction string at index 1.
         * @throws SyntaxError
         *  The specified string is not a valid mnemonic.
         */
        static ParseMnemonic(s: string) {
            var ret = {};
            var matched = false;
            s = s.replace(/\t/g, ' ').trim();
            var T = s.split(' ');
            for (let i = 0; i < T[0].length; i++ , ret = {}) {
                var mnemonic = T[0].substr(0, i + 1).toUpperCase();
                if (this.mnemonics.indexOf(mnemonic) < 0)
                    continue;
                ret['Mnemonic'] = mnemonic;
                var d = T[0].substr(i + 1);
                var cond = d.substr(0, 2).toUpperCase();
                if (this.conditions.indexOf(cond) >= 0) {
                    ret['Condition'] = cond;
                    d = d.substr(cond.length);
                }
                if (d == '') {
                    matched = true;
                    break;
                }
                var sl = this.suffixes[mnemonic];
                if (!sl)
                    continue;
                for (var c = 0; c < sl.length; c++) {
                    var re = new RegExp(`^(${sl[c].Suffix})${sl[c].Required ? '' : '?'}`, 'i');
                    if (!re.exec(d) || RegExp.$1 == '')
                        continue;
                    ret[sl[c].Name ? sl[c].Name : sl[c].Suffix] = RegExp.$1.toUpperCase();
                    d = d.substr(RegExp.$1.length);
                }
                if (d == '') {
                    matched = true;
                    break;
                }
            }
            if (!matched)
                throw new SyntaxError(`Invalid mnemonic ${s}`);
            return [ret, s.substr(s.indexOf(' ')).trim()];
        }

        /**
         * Parses the ARM register identifier from the specified string.
         * 
         * @param {string} s
         *  The string to parse the ARM register identifier from.
         * @return {string}
         *  An ARM register identifier (R0 to R15).
         * @throws Error
         *  The specified string is not a valid ARM register identifier.
         */
        static ParseRegister(s: string): string {
            var n = { 'FP': 'R11', 'SP': 'R13', 'LR': 'R14', 'PC': 'R15' };
            s = s.trim().toUpperCase();
            if (s.length == 2) {
                if (s[0] == 'R' && !isNaN(parseInt(s[1])))
                    return s;
                if (n[s])
                    return n[s];
            } else if (s.length == 3) {
                if (s[0] == 'R' && s[1] == '1' && parseInt(s[2]) < 6)
                    return s;
            }
            throw new SyntaxError(`Unexpected ARM register identifier '${s}'`);
        }

        /**
         * Parses the ARM coprocessor register identifier from the specified string.
         * 
         * @param {string} s
         *  The string to parse the ARM register identifier from.
         * @return {string}
         *  An ARM co-processor register identifier (C0 to C15).
         * @throws Error
         *  The specified string is not a valid ARM co-processor register identifier.
         */
        static ParseCPRegister(s: string): string {
            s = s.trim().toUpperCase();
            if (s.length == 2) {
                if (s[0] == 'C' && !isNaN(parseInt(s[1])))
                    return s;
            } else if (s.length == 3) {
                if (s[0] == 'C' && s[1] == '1' && parseInt(s[2]) < 6)
                    return s;
            }
            throw new SyntaxError(`Expected co-processor register identifier '${s}'`);
        }

        /**
         * Parses an expression from the specified string.
         * 
         * @param {string} s
         *  The string to parse an expression from.
         * @return {number}
         *  The parsed and evaluated expression.
         * @throws Error
         *  The specified string is not a valid expression.
         */
        ParseExpression(s: string) {
            if (s[0] == '#')
                s = s.substr(1);
            try {
                let t = parseInt(eval(s));
                if (!isNaN(t))
                    return t;
            } catch (e) {
                var m = s.match(/[A-Za-z_]\w+/g);
                for (var i of m) {
                    s = s.replace(new RegExp(i, 'g'), this.symbolLookup(i));
                }
                try {
                    let t = parseInt(eval(s));
                    if (isNaN(t))
                        throw new Error(`Invalid expression '${s}'`);
                    return t;
                } catch (e) {
                    throw new Error(`Unresolved symbol '${s}'`);
                }
            }
            // ReSharper disable once NotAllPathsReturnValue
        }

        /**
         * Parses and validates the operands contained in the specified parameter for the
         * specified mnemonic.
         * 
         * @param {string} mnemonic
         *  The mnemonic for which to parse the operands specified by the second parameter.
         * @param {string} operands
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         * @throw Error
         *  A syntax error has been encountered or the combination of passed operands is
         *  invalid for the respective instruction.
         */
        ParseOperands(mnemonic: string, operands: string): {} {
            // Group and map mnemonics to methods for parsing their respective operands.
            var lookup = [
                [['BX'], 0],
                [['BL', 'B', 'SWI'], 1],
                [['AND', 'EOR', 'SUB', 'RSB', 'ADD', 'ADC',
                    'SBC', 'RSC', 'ORR', 'BIC'], 2],
                [['MRS'], 3],
                [['MSR'], 4],
                [['MUL'], 5],
                [['MLA'], 6],
                [['UMULL', 'UMLAL', 'SMULL', 'SMLAL'], 7],
                [['LDR', 'STR'], 8],
                [['LDM', 'STM'], 9],
                [['SWP'], 10],
                [['CDP'], 11],
                [['LDC', 'STC'], 12],
                [['MCR', 'MRC'], 13],
                [['MOV', 'MVN'], 14],
                [['NOP'], 15],
                [['PUSH', 'POP'], 16],
                [['LSL', 'LSR', 'ASR', 'ROR'], 17],
                [['RRX'], 18],
                [['CMP', 'CMN', 'TEQ', 'TST'], 19]
            ];
            for (var entry of lookup) {
                if ((entry[0] as string[]).indexOf(mnemonic.toUpperCase()) >= 0)
                    return this[`ParseOperands_${entry[1]}`](operands);
            }
            throw new SyntaxError(`Invalid Mnemonic ${mnemonic}`);
        }

        /**
         * Parses operands for instructions in the form of '<B>{cond} Rn'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private static ParseOperands_0(s: string) {
            return {
                Rn: this.ParseRegister(s)
            };
        }

        /**
         * Parses operands for instructions in the form of '<B|BL>{cond} <expression>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_1(s: string) {
            var t = this.ParseExpression(s);
            if (t % 4)
                throw new SyntaxError(`Misaligned branch destination ${t}`);
            // Offset is 24 bits signed field which is shifted left 2 bits to allow for a
            // +/-32Mbytes PC-relative jump.
            if (t < -33554432 || t > 33554431)
                throw new RangeError(`Branch destination ${t} is out of range`);
            return {
                Offset: t
            };
        }

        /**
         * Parses operands for instructions in the form of '<ADD|AND|Etc.>{cond}{S} Rd,Rn,<Op2>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_2(s: string) {
            var r = {};
            var a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length == 1)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['Rd'] = Parser.ParseRegister(a[0]);
            var isImm = false;
            try {
                r['Rn'] = Parser.ParseRegister(a[1]);
            } catch (e) {
                r['Rn'] = this.ParseExpression(a[1]);
                isImm = true;
            }
            if (isImm && a.length > 2)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            if (a.length == 2) {
                if (isImm) {
                    r['Op2'] = Util.EncodeImmediate(r['Rn']);
                    r['Immediate'] = true;
                }
                else
                    r['Op2'] = r['Rn'];
                r['Rn'] = r['Rd'];
                return r;
            }
            try {
                r['Op2'] = Parser.ParseRegister(a[2]);
            } catch (e) {
                let t = this.ParseExpression(a[2]);
                var enc = Util.EncodeImmediate(t);
                r['Immediate'] = true;
                r['Op2'] = enc;
            }
            if (a.length == 3)
                return r;
            if (r['Immediate']) {
                if (r['Op2'].Rotate > 0)
                    throw new Error('Illegal shift on rotated value');
                let t = this.ParseExpression(a[3]);
                if ((t % 2) || t < 0 || t > 30)
                    throw new Error(`Invalid rotation: ${t}`);
                r['Op2'].Rotate = t / 2;
            } else {
                if (a[3].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
                    r['ShiftOp'] = RegExp.$1;
                    var f = RegExp.$2;
                    try {
                        r['Shift'] = Parser.ParseRegister(f);
                    } catch (e) {
                        let t = this.ParseExpression(f);
                        if (t > 31)
                            throw new RangeError('Shift value out of range');
                        r['Shift'] = t;
                    }
                }
                else if (a[3].match(/^RRX$/i))
                    r['Rrx'] = true;
                else
                    throw new SyntaxError(`Invalid expression ${a[3]}`);
            }
            if (a.length > 4)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            return r;
        }

        /**
         * Parses operands for the MRS instruction.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_3(s: string) {
            var r = { Rd: '', P: '' };
            var a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length == 1)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r.Rd = Parser.ParseRegister(a[0]);
            if (r.Rd == 'R15')
                throw new Error('R15 is not allowed as destination register');
            if (!a[1].match(/^(CPSR|CPSR_all|SPSR|SPSR_all)$/i))
                throw new SyntaxError(`Constant identifier expected for ${a[1]}`);
            r.P = RegExp.$1.toUpperCase();
            return r;
        }

        /**
         * Parses operands for the MSR instruction.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_4(s: string) {
            var r: { P: string, Op2: string | number } = { P: '', Op2: 0 };
            var a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length == 1)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            if (!a[0].match(/^(CPSR|CPSR_all|SPSR|SPSR_all|CPSR_flg|SPSR_flg)$/i))
                throw new SyntaxError(`Constant identifier expected for ${a[0]}`);
            r['P'] = RegExp.$1.toUpperCase();
            var imm = r['P'].match(/_flg/i) != null;
            try {
                r['Op2'] = Parser.ParseRegister(a[1]);
                if (r['Op2'] == 'R15')
                    throw new Error('R15 is not allowed as source register');
            } catch (e) {
                if (!imm)
                    throw e;
                var t = this.ParseExpression(a[1]);
                var l = 0;
                for (let i = 31; i >= 0; i--) {
                    if (!l && ((t >>> i) & 0x1))
                        l = i;
                    if ((l - i) > 8 && ((t >>> i) & 0x1))
                        throw new Error(`Invalid constant (${t.toString(16)}) after fixup`);
                }
                r['Op2'] = this.ParseExpression(a[1]);
            }
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<MUL>{cond}{S} Rd,Rm,Rs'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_5(s: string) {
            var r = {};
            var a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length != 3)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            for (let i = 1; i < 4; i++) {
                r[`Op${i}`] = Parser.ParseRegister(a[i - 1]);
                if (r[`Op${i}`] == 'R15')
                    throw new Error('R15 must not be used as operand');
            }
            if (r['Op1'] == r['Op2'])
                throw new Error('Destination register must not be the same as operand');
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<MLA>{cond}{S} Rd,Rm,Rs,Rn'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_6(s: string) {
            var r = {};
            var a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length != 4)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            for (let i = 1; i < 5; i++) {
                r[`Op${i}`] = Parser.ParseRegister(a[i - 1]);
                if (r[`Op${i}`] == 'R15')
                    throw new Error('R15 must not be used as operand');
            }
            if (r['Op1'] == r['Op2'])
                throw new Error('Destination register must not be the same as operand');
            return r;
        }

        /**
         * Parses operands for instructions in the form of
         * '<UMULL|MLAL|Etc.>{cond}{S} RdLo,RdHi,Rm,Rs'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_7(s: string) {
            var r = {};
            var a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length != 4)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            var e = {};
            for (let i = 1; i < 5; i++) {
                r[`Op${i}`] = Parser.ParseRegister(a[i - 1]);
                if (r[`Op${i}`] == 'R15')
                    throw new Error('R15 must not be used as operand');
                if (e[r[`Op${i}`]])
                    throw new Error('Operands must specify different registers');
                e[r[`Op${i}`]] = true;
            }
            return r;
        }
    }
}