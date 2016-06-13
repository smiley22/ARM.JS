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

        private symbolLookup: (symbol: string) => Symbol;
        private sectionPos: () => number;

        constructor(symbolLookup: (symbol: string) => Symbol, sectionPos: () => number) {
            this.symbolLookup = symbolLookup;
            this.sectionPos = sectionPos;
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
            let ret = {},
                matched = false;
            s = s.replace(/\t/g, ' ').trim();
            var T = s.split(' ');
            for (let i = 0; i < T[0].length; i++ , ret = {}) {
                var mnemonic = T[0].substr(0, i + 1).toUpperCase();
                if (this.mnemonics.indexOf(mnemonic) < 0)
                    continue;
                ret['Mnemonic'] = mnemonic;
                let d = T[0].substr(i + 1),
                    cond = d.substr(0, 2).toUpperCase();
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
                for (let c = 0; c < sl.length; c++) {
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
                    s = s.replace(new RegExp(i, 'g'), this.symbolLookup(i).Value);
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
         * Parses an address as is accepted by instructions such as LDR and STR.
         * 
         * @param {string} s
         *  The string to parse an address from.
         * @return {object}
         *  The parsed address.
         * @throws Error
         *  The specified string is not a valid address.
         */
        private ParseAddress(s: string): any {
            let ret: any;
            s = s.trim();
            // Expression
            if (s[0] == '=') {
                return {
                    Type: 'Imm',
                    Offset: this.ParseExpression(s.substr(1)),
                    Pseudo: true
                };
            }
            // Pre-indexed addressing
            if (s.match(/^\[\s*(\w+)\s*,\s*(.*)\](!)?$/i)) {
                ret = {
                    Type: 'Pre',
                    Source: Parser.ParseRegister(RegExp.$1),
                    Writeback: RegExp.$3 ? true : false
                };
                let tmp = RegExp.$2.trim();
                try {
                    ret['Offset'] = this.ParseExpression(tmp);
                    ret['Immediate'] = true;
                } catch (e) {
                    let m = tmp.match(/^([+|-])?\s*(\w+)(\s*,\s*(ASL|LSL|LSR|ASR|ROR)\s*(.*))?$/i);
                    if (!m)
                        throw new Error(`Invalid address expression ${s}`);
                    ret['Subtract'] = m[1] == '-';
                    ret['Offset'] = Parser.ParseRegister(m[2]);
                    if (m[3]) {
                        ret['ShiftOp'] = m[4].toUpperCase();
                        let t = this.ParseExpression(m[5]);
                        if (t > 31)
                            throw new Error(`Shift expression too large ${t}`);
                        ret['Shift'] = t;
                    }
                }
            }
            // Post-indexed addressing
            else if (s.match(/^\[\s*(\w+)\s*\]\s*(,(.*))?$/i)) {
                ret = {
                    Type: 'Post',
                    Source: Parser.ParseRegister(RegExp.$1)
                };
                if (!RegExp.$2)
                    return ret;
                let tmp = RegExp.$3.trim();
                try {
                    ret['Offset'] = this.ParseExpression(tmp);
                    ret['Immediate'] = true;
                } catch (e) {
                    let m = tmp.match(/^([+|-])?\s*(\w+)(\s*,\s*(ASL|LSL|LSR|ASR|ROR)\s*(.*))?$/i);
                    ret['Subtract'] = m[1] == '-';
                    ret['Offset'] = Parser.ParseRegister(m[2]);
                    if (m[3]) {
                        ret['ShiftOp'] = m[4].toUpperCase();
                        let t = this.ParseExpression(m[5]);
                        if (t > 31)
                            throw new Error(`Shift expression too large ${t}`);
                        ret['Shift'] = t;
                    }
                }
            }
            else {
                // Labels evaluate to PC-relative addressing
                var addr = this.symbolLookup(s).Value;
                if (addr) {
                    var dist = addr - this.sectionPos();
                    return {
                        Type: 'Pre',
                        Source: 'R15',
                        Immediate: true,
                        Offset: dist
                    };
                }
                // Give up
                else
                    throw new SyntaxError(`Invalid address expression ${s}`);
            }
            return ret;
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
            var r = {},
                a = s.split(',');
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
            var r = { Rd: '', P: '' },
                a = s.split(',');
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
            var r: { P: string, Op2: string | number } = { P: '', Op2: 0 },
                a = s.split(',');
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
                let t = this.ParseExpression(a[1]),
                    l = 0;
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
            var r = {},
                a = s.split(',');
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
            var r = {},
                a = s.split(',');
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
            var r = {},
                a = s.split(',');
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

        /**
         * Parses operands for instructions in the form of '<LDR|STR>{cond}{B}{T} Rd,<Address>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_8(s: string) {
            var r = {};
            s = s.trim();
            if (!s.match(/^(\w+)\s*,\s*(.*)$/i))
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['Rd'] = Parser.ParseRegister(RegExp.$1);
            return Util.MergeObjects(
                r,
                this.ParseAddress(RegExp.$2)
            );
        }

        /**
         * Parses operands for instructions in the form of
         * '<LDM|STM>{cond}<FD|ED|FA|EA|IA|IB|DA|DB> Rn{!},<Rlist>{^}'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_9(s: string) {
            var r = {};
            s = s.trim();
            if (!s.match(/^(\w+)\s*(!)?\s*,\s*{(.*)}\s*(\^)?$/i))
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['Rn'] = Parser.ParseRegister(RegExp.$1);
            r['Writeback'] = RegExp.$2 ? true : false;
            r['S'] = RegExp.$4 ? true : false;
            r['RList'] = [];
            // Parse register list.
            let t = RegExp.$3.split(',');
            for (let i in t) {
                var e = t[i].trim();
                if (e.match(/^R(\d{1,2})\s*-\s*R(\d{1,2})$/i)) {
                    var a = parseInt(RegExp.$1),
                        b = parseInt(RegExp.$2);
                    if (a >= b)
                        throw new RangeError(`Bad register range [${a},${b}]`);
                    if (a > 15 || b > 15)
                        throw new SyntaxError('ARM register expected (R0 - R15)');
                    for (let c = a; c <= b; c++)
                        r['RList'].push(`R${c}`);
                }
                else
                    r['RList'].push(Parser.ParseRegister(e));
            }
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<SWP>{cond}{B} Rd,Rm,[Rn]'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_10(s: string) {
            var r = {},
                m = s.trim().match(/^(\w+)\s*,\s*(\w+)\s*,\s*\[\s*(\w+)\s*]$/i);
            if (!m)
                throw new SyntaxError(`ARM register identifier expected ${s}`);
            for (let i = 1; i < 4; i++) {
                r[`Op${i}`] = Parser.ParseRegister(m[i]);
                if (r[`Op${i}`] == 'R15')
                    throw new Error('R15 must not be used as operand');
            }
            return r;
        }

        /**
         * Parses operands for instructions in the form of
         *  'CDP{cond} p#,<expression1>,cd,cn,cm{,<expression2>}'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_11(s: string) {
            var r = {},
                a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length < 5 || a.length > 6)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            if (a[0][0].toUpperCase() != 'P')
                throw new SyntaxError(`Coprocessor number expected ${s}`);
            r['CP'] = parseInt(a[0].substr(1));
            if (r['CP'] > 15)
                throw new Error(`Coprocessor number out of range ${r['CP']}`);
            let t = this.ParseExpression(a[1]);
            if (t > 15)
                throw new RangeError('Expression out of range');
            r['CPOpc'] = t;
            r['Cd'] = Parser.ParseCPRegister(a[2]);
            r['Cn'] = Parser.ParseCPRegister(a[3]);
            r['Cm'] = Parser.ParseCPRegister(a[4]);
            if (a.length == 6) {
                t = this.ParseExpression(a[5]);
                if (t > 7)
                    throw new RangeError('Expression out of range');
                r['CPType'] = t;
            }
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<LDC|STC>{cond}{L} p#,cd,<Address>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_12(s: string) {
            var r = {};
            if (!s.trim().match(/^P(\d{1,2})\s*,\s*(\w+)\s*,\s*(.*)$/i))
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['CP'] = parseInt(RegExp.$1);
            if (r['CP'] > 15)
                throw new Error(`Coprocessor number out of range ${r['CP']}`);
            r['Cd'] = Parser.ParseCPRegister(RegExp.$2);
            var a = this.ParseAddress(RegExp.$3.trim());
            if (a.Offset > 0xFF)
                throw new RangeError(`Coprocessor offset out of range ${a.Offset}`);
            if (a.Shift)
                throw new SyntaxError('Invalid coprocessor offset');
            return Util.MergeObjects(a, r);
        }

        /**
         * Parses operands for instructions in the form of
         *  '<MCR|MRC>{cond} p#,<expression1>,Rd,cn,cm{,<expression2>}'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_13(s: string) {
            var r = {},
                a = s.split(',');
            for (let  i in a)
                a[i] = a[i].trim();
            if (a.length < 5 || a.length > 6)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            if (a[0][0].toUpperCase() != 'P')
                throw new SyntaxError(`Coprocessor number expected ${s}`);
            r['CP'] = parseInt(a[0].substr(1));
            if (r['CP'] > 15)
                throw new Error(`Coprocessor number out of range ${r['CP']}`);
            let  t = this.ParseExpression(a[1]);
            if (t > 15)
                throw new RangeError('Expression out of range');
            r['CPOpc'] = t;
            r['Rd'] = Parser.ParseRegister(a[2]);
            r['Cn'] = Parser.ParseCPRegister(a[3]);
            r['Cm'] = Parser.ParseCPRegister(a[4]);
            if (a.length == 6) {
                t = this.ParseExpression(a[5]);
                if (t > 7)
                    throw new RangeError('Expression out of range');
                r['CPType'] = t;
            }
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<MOV|MVN|Etc.>{cond}{S} Rd,<Op2>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_14(s: string) {
            var r = {},
                a = s.split(',');
            for (let i in a) {
                if (a.hasOwnProperty(i))
                    a[i] = a[i].trim();
            }
            if (a.length == 1)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['Rd'] = Parser.ParseRegister(a[0]);
            let isRotated = false;
            try {
                r['Op2'] = Parser.ParseRegister(a[1]);
            } catch (e) {
                let t = this.ParseExpression(a[1]),
                    enc = Util.EncodeImmediate(t);
                isRotated = enc.Rotate > 0;
                r['Immediate'] = true;
                r['Op2'] = enc;
            }
            if (a.length == 2)
                return r;
            if (r['Immediate']) {
                if (isRotated)
                    throw new Error('Illegal shift on rotated value');
                let t = this.ParseExpression(a[2]);
                if ((t % 2) || t < 0 || t > 30)
                    throw new Error(`Invalid rotation: ${t}`);
                r['Op2'].Rotate = t / 2;
            } else {
                if (a[2].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
                    r['ShiftOp'] = RegExp.$1;
                    let f = RegExp.$2;
                    try {
                        r['Shift'] = Parser.ParseRegister(f);
                    } catch (e) {
                        let t = this.ParseExpression(f);
                        if (t > 31)
                            throw new Error('Expression out of range');
                        r['Shift'] = t;
                    }
                }
                else if (a[2].match(/^RRX$/i)) {
                    r['Rrx'] = true;
                }
                else
                    throw new SyntaxError('Invalid expression');
            }
            if (a.length > 3)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<NOP>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_15(s: string) {
            return {};
        }

        /**
         * Parses operands for instructions in the form of '<PUSH|POP> <Rlist>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_16(s: string) {
            // PUSH/POP are just assembler shortcuts for STMFD SP! and LDMFD SP!, respectively.
            if (!s.trim().match(/^{(.*)}\s*$/i))
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            var r = { Rn: 'R13', Writeback: true, Mode: 'FD' },
                a = RegExp.$1.split(',');
            r['RList'] = [];
            for (let  i in a) {
                var e = a[i].trim();
                if (e.match(/^R(\d{1,2})\s*-\s*R(\d{1,2})$/i)) {
                    var from = parseInt(RegExp.$1),
                        to = parseInt(RegExp.$2);
                    if (from >= to)
                        throw new RangeError(`Bad register range [${from},${to}]`);
                    if (from > 15 || to > 15)
                        throw new SyntaxError('ARM register expected (R0 - R15)');
                    for (let c = from; c <= to; c++)
                        r['RList'].push(`R${c}`);
                }
                else
                    r['RList'].push(Parser.ParseRegister(e));
            }
            return r;
        }

        /**
         * Parses operands for instructions in the form of
         *  '<LSL|LSR|ASR|ROR>{Cond}{S} Rd, Rn, Shift'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_17(s: string) {
            var r = {},
                a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length < 2 || a.length > 3)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['Rd'] = Parser.ParseRegister(a[0]);
// ReSharper disable once AssignedValueIsNeverUsed
            let isReg = false;
            try {
                r['Op2'] = Parser.ParseRegister(a[1]);
                isReg = true;
            } catch (e) {
                r['Op2'] = r['Rd'];
                r['Shift'] = this.ParseExpression(a[1]);
                // ShiftOp will be resolved in pass 1.
                return r;
            }
// ReSharper disable once ConditionIsAlwaysConst
            if (isReg && a.length == 2)
                throw new SyntaxError(`Shift expression expected ${s}`);
            r['Shift'] = this.ParseExpression(a[2]);
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<RRX>{Cond}{S} Rd, Rn'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_18(s: string) {
            var r = { Rd: '', Op2: '', Rrx: true },
                a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length != 2)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r.Rd = Parser.ParseRegister(a[0]);
            r.Op2 = Parser.ParseRegister(a[1]);
            return r;
        }

        /**
         * Parses operands for instructions in the form of '<CMP|TEQ|Etc.>{cond}{S} Rn,<Op2>'.
         * 
         * @param {string} s
         *  A string containing the operands to parse.
         * @return
         *  An object containing the parsed operand information.
         */
        private ParseOperands_19(s: string) {
            var r = {},
                a = s.split(',');
            for (let i in a)
                a[i] = a[i].trim();
            if (a.length == 1)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            r['Rn'] = Parser.ParseRegister(a[0]);
            let isRotated = false;
            try {
                r['Op2'] = Parser.ParseRegister(a[1]);
            } catch (e) {
                let t = this.ParseExpression(a[1]),
                    enc = Util.EncodeImmediate(t);
                isRotated = enc.Rotate > 0;
                r['Immediate'] = true;
                r['Op2'] = enc;
            }
            if (a.length == 2)
                return r;
            if (r['Immediate']) {
                if (isRotated)
                    throw new Error('Illegal shift on rotated value');
                let t = this.ParseExpression(a[2]);
                if ((t % 2) || t < 0 || t > 30)
                    throw new Error(`Invalid rotation: ${t}`);
                r['Op2'].Rotate = t / 2;
            } else {
                if (a[2].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
                    r['ShiftOp'] = RegExp.$1;
                    let f = RegExp.$2;
                    try {
                        r['Shift'] = Parser.ParseRegister(f);
                    } catch (e) {
                        let t = this.ParseExpression(f);
                        if (t > 31)
                            throw new Error('Expression out of range');
                        r['Shift'] = t;
                    }
                }
                else if (a[2].match(/^RRX$/i)) {
                    r['Rrx'] = true;
                }
                else
                    throw new SyntaxError('Invalid expression');
            }
            if (a.length > 3)
                throw new SyntaxError(`Invalid instruction syntax ${s}`);
            return r;
        }
    }
}