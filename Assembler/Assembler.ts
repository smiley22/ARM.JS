///<reference path="Litpool.ts"/>
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
        private selectedSection: Section = null;

        /**
         * The collection of sections into which statements and data can be assembled.
         */
        private sections: HashTable<Section> = {};

        /**
         * The assembler's symbol table.
         */
        private symbols: HashTable<Symbol> = {};

        /**
         * An array of literal pools for storing integer literals.
         */
        private litpools = new Array<Litpool>();

        private layout: HashTable<number> = {};

        /**
         * The parser used for parsing mnemonics, operands and expressions.
         */
        private parser = new Parser(s => this.ResolveSymbol(s),
            () => this.selectedSection.Position);

        /**
         * Assembles and links the specified input using the specified memory layout.
         * 
         * @param {string} source
         *  The input source code to assemble.
         * @param {object} layout
         *  An object describing the memory layout of the output file where each key denotes
         *  a section name and each value denotes the section's respective base address in
         *  memory.
         */
        static Assemble(source: string, layout: HashTable<number>) {
            let asm = new Assembler(layout),
                lines = asm.GetSourceLines(source);
            lines = asm.Pass_0(lines);
            // Create a literal pool at the end of the .text section.
            asm.CreateLitPool(asm.sections['TEXT'].Size);
            for (let name in asm.sections)
                asm.sections[name].Commit();
            asm.Pass_1(lines);
            let ret = {};
            for (let s in asm.sections) {
                ret[s] = {
                    address: layout[s],
                    data: asm.sections[s].Buffer
                }
            }
            return ret;
        }

        /**
         * Initializes a new instance of the Assembler class.
         */
        constructor(layout: HashTable<number>) {
            let name = 'TEXT';
            // Initialize .TEXT section and select as default.
            this.sections[name] = new Section(name);
            this.selectedSection = this.sections[name];
            this.layout = layout;
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
            for (let line of Util.StripComments(source).split('\n')) {
                // Trim all lines and skip empty ones.
                if ((line = line.replace(/\t/g, ' ').trim()) != '')
                    lines.push(line);
            }
            return lines;
        }

        /**
         * Passes over the source lines and builds up a table with all symbols and their values.
         * 
         * @param {string[]} lines
         *  The source lines to pass over.
         * @return {string[]}
         *  An array of source lines to feed into the next assembler pass as input.
         */
        private Pass_0(lines: string[]) {
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                // Label definition
                if (line.match(/^(.*):(.*)$/)) {
                    this.ProcessLabel(RegExp.$1.trim());
                    // Remove label from line and fall through.
                    line = lines[i] = RegExp.$2.trim();
                    if (line == '')
                        continue;
                }
                // Assembler directive
                if (line.match(/^\.(\w+)\s*(.*)/)) {
                    if (this.ProcessDirective_0(RegExp.$1, RegExp.$2))
                        lines[i] = ''; // Remove directive from output of pass 0.
                } else {
                    // Assume it's an instruction. All instructions are 32-bit long.
                    this.selectedSection.Grow(4);
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

        /**
         * Processes the specified directive encountered during the first pass of the assembler.
         * 
         * @param {string} directive
         *  The directive to process.
         * @param {string} params
         *  The parameters of the directive, if any.
         * @return {boolean}
         *  true if the directive should be removed from input; otherwise false.
         */
        private ProcessDirective_0(directive: string, params: string) {
            directive = directive.toUpperCase().trim();
            if (!this.IsValidDirective(directive))
                throw new Error(`Unknown assembler directive: ${directive}`);
            switch (directive) {
                case 'SECTION':
                    if (!params)
                        throw new Error('Missing argument for .SECTION');
                    this.SwitchSection(params.replace(/^\./, '').toUpperCase());
                    break;
                case 'DATA':
                case 'TEXT':
                case 'RODATA':
                case 'BSS':
                    this.SwitchSection(directive);
                    break;
                case 'EQU':
                case 'SET':
                    this.ProcessEQU(params);
                    return true;
                case 'ASCII':
                case 'ASCIZ':
                    let strLength = this.ProcessStringLiterals(params,
                        directive == 'ASCIZ', true);
                    this.selectedSection.Grow(strLength);
                    break;
                case 'ALIGN':
                    let sectionSize = this.selectedSection.Size,
                        align = params ? parseInt(eval(params)) : 4;
                    if (isNaN(align))
                        throw new Error(`Invalid alignment for .ALIGN directive ${params}`);
                    if (sectionSize % align)
                        this.selectedSection.Grow(align - (sectionSize % align));
                    break;
                case 'SKIP':
                    if (!params)
                        throw new Error('Missing argument for .SKIP');
                    let numBytes = parseInt(eval(params));
                    if (isNaN(numBytes))
                        throw new Error(`Invalid argument for .SKIP directive ${params}`);
                    this.selectedSection.Grow(numBytes);
                    break;
                case 'BYTE':
                case 'HWORD':
                case 'WORD':
                case '2BYTE':
                case '4BYTE':
                    let typeSize = { 'BYTE': 1, 'HWORD': 2, 'WORD': 4, '2BYTE': 2, '4BYTE': 4 },
                        numElems = params.split(',').length,
                        size = typeSize[directive] * numElems;
                    this.selectedSection.Grow(size);
                    break;
            }
            return false;
        }

        /**
         * Switches the assembler to the section with the specified name.
         * 
         * @param {string} name
         *  The name of the section to switch to. Any subsequent instructions will be
         *  assembled onto the section specified.
         */
        private SwitchSection(name: string) {
            if (!this.sections[name])
                this.sections[name] = new Section(name);
            this.selectedSection = this.sections[name];
        }

        /**
         * Processes a label definition and adds it to the assembler's symbol table.
         * 
         * @param {string} name
         *  The name of the label.
         */
        private ProcessLabel(name: string) {
            if (this.symbols[name])
                throw new Error(`Symbol re-definition: "${name}"`);
            // Add label to symbol table.
            this.symbols[name] = new Symbol(name, this.selectedSection.Size, true,
                this.selectedSection);
        }

        /**
         * Processes an .EQU directive with the specified parameters.
         * 
         * @param {string} params
         *  The parameters of the .EQU directive.
         */
        // ReSharper disable once InconsistentNaming
        private ProcessEQU(params: string) {
            params = params.trim();
            if (!params.match(/^(\w+),(.*)$/))
                throw new Error(`Invalid arguments for .EQU directive ${params}`);
            let name = RegExp.$1.trim(),
                value = RegExp.$2.trim();
            if (this.symbols[name])
                throw new Error(`Symbol re-definition: "${name}"`);
            // Replace all occurrences of existing symbol names in equ.
            for (let key in this.symbols) {
                let symbol = this.symbols[key];
                if (symbol.Label)
                    continue;
                value = value.replace(new RegExp(key, 'g'), symbol.Value);
            }
            // Create entry in symbol table.
            this.symbols[name] = new Symbol(name, value, false);
            // Replace all occurrences of equ in existing entries with its' value.
            for (let key in this.symbols) {
                let symbol = this.symbols[key];
                if (key == name || symbol.Label)
                    continue;
                symbol.Value = (symbol.Value as string).replace(new RegExp(name, 'g'), value);
            }
        }

        /**
         * Processes .ASCII and .ASCIZ directives.
         * 
         * @param {string} literals
         *  Zero or more string literals, separated by commas.
         * @param {boolean} nullTerminated
         *  true if every string is followed by a zero byte as in the .ASCIZ directive.
         * @param {boolean} computeLengthOnly
         *  true to only compute the length, that is, the number of bytes required by the
         *  string literals when they are assembled into consecutive addresses, without
         *  actually writing data to the current section.
         * @return {number}
         *  The number of bytes required by the string literals when they are assembled
         *  into consecutive addresses.
         */
        private ProcessStringLiterals(literals: string, nullTerminated: boolean,
            computeLengthOnly = false) {
            try {
                let list: string[] = eval(`[${literals}]`),
                    length = 0;
                for (let str of list) {
                    if (!computeLengthOnly) {
                        for (let i = 0; i < str.length; i++)
                            this.selectedSection.Write(str.charCodeAt(i) & 0xFF, 'BYTE');
                        if (nullTerminated)
                            this.selectedSection.Write(0x00, 'BYTE');
                    }
                    length = length + str.length + (nullTerminated ? 1 : 0);
                }
                return length;
            } catch (e) {
                throw new Error(`Invalid literals ${literals}: ${e}`);
            }
        }

        /**
         * Passes over the source lines and assembles the actual instruction words.
         * 
         * @param {string[]} lines
         *  The source lines to pass over.
         */
        private Pass_1(lines: string[]) {
            for (var line of lines) {
                // Assembler directive
                if (line.match(/^\.(\w+)\s*(.*)/)) {
                    this.ProcessDirective_1(RegExp.$1, RegExp.$2);
                } else {
                    var iw = this.AssembleInstruction(line);
                    this.selectedSection.Write(iw, 'WORD');
                }
            }
        }

        /**
         * Assembles the specified line of source code.
         * 
         * @param {string} line
         *  The line of source code to assemble.
         * @return {number}
         *  A 32-bit ARMv4T instruction word.
         */
        private AssembleInstruction(line: string) {
            var data = Parser.ParseMnemonic(line),
                operands = this.parser.ParseOperands(data[0]['Mnemonic'], data[1] as string);
            return this.BuildInstruction(
                Util.MergeObjects(data[0], operands)
            );
        }

        /**
         * Processes the specified directive encountered during the second pass of the assembler.
         * 
         * @param {string} directive
         *  The directive to process.
         * @param {string} params
         *  The parameters of the directive, if any.
         * @return {boolean}
         *  true if the directive should be removed from input; otherwise false.
         */
        private ProcessDirective_1(directive: string, params: string) {
            directive = directive.toUpperCase().trim();
            if (!this.IsValidDirective(directive))
                throw new Error(`Unknown assembler directive: ${directive}`);
            switch (directive) {
                case 'SECTION':
                    if (!params)
                        throw new Error('Missing argument for .SECTION');
                    this.SwitchSection(params.replace(/^\./, '').toUpperCase());
                    break;
                case 'DATA':
                case 'TEXT':
                case 'RODATA':
                case 'BSS':
                    this.SwitchSection(directive);
                    break;
                case 'ASCII':
                case 'ASCIZ':
                    this.ProcessStringLiterals(params, directive == 'ASCIZ');
                    break;
                case 'ALIGN':
                    let sectionSize = this.selectedSection.Position,
                        align = params ? parseInt(eval(params)) : 4;
                    if (isNaN(align))
                        throw new Error(`Invalid alignment for .ALIGN directive ${params}`);
                    if (sectionSize % align) {
                        let pad = align - (sectionSize % align);
                        for (let i = 0; i < pad; i++)
                            this.selectedSection.Write(0x00, 'BYTE');
                    }
                    break;
                case 'SKIP':
                    if (!params)
                        throw new Error('Missing argument for .SKIP');
                    let numBytes = parseInt(eval(params));
                    if (isNaN(numBytes))
                        throw new Error(`Invalid argument for .SKIP directive ${params}`);
                    this.selectedSection.Position += numBytes;
                    break;
                case 'BYTE':
                case 'HWORD':
                case 'WORD':
                case '2BYTE':
                case '4BYTE':
                    this.ProcessData(directive, params);
                    break;
            }
            return false;
        }

        /**
         * Processes data directives during pass 1 of the assembler.
         * 
         * @param {string} directive
         *  The data directive to process.
         * @param {string} data
         *  A list of comma-separated data values.
         */
        private ProcessData(directive: string, data: string) {
            let e = { 'BYTE': 1, 'HWORD': 2, 'WORD': 4, '2BYTE': 2, '4BYTE': 4 },
                size = e[directive.toUpperCase()];
            //var max = ((1 << (size * 8)) - 1) & 0xffffffff;
            var min = (-(1 << (size * 8 - 1))) & 0xffffffff;
            for (let lit of data.split(',')) {
                lit = lit.trim();
                let num = this.parser.ParseExpression(lit);
                if (num < min) {
                    console.info(`Warning: ${num} truncated to ${min}`);
                    num = min;
                }
                //else if (num > max) {
                //    console.info(`Warning: ${num} truncated to ${max}`);
                //    num = max;
                //}
                this.selectedSection.Write(num, directive);
            }
        }

        /**
         * Creates a literal pool at the specified position.
         * 
         * @param {number} position
         *  The position in the .text section where the literal pool will be located.
         */
        private CreateLitPool(position: number) {
            var litpool = new Litpool(this.sections['TEXT'], position);
            this.litpools.push(litpool);
        }

        /**
         * Gets the closest literal pool with respect to the specified position.
         * 
         * @param {number} position
         *  The position from which to find the closest literal pool.
         * @return {Litpool}
         *  The literal pool that is located closest to the position specified.
         */
        private GetNearestLitPool(position: number) {
            // FIXME: At the moment we only support a single literal pool that is located at
            //        the end of the .text section. This should be expanded so that we support
            //        arbitrary litpools and this method returns the closest litpool with respect
            //        to the specified position.
            return this.litpools[0];
        }

        /**
         * Resolves the symbol with the specified name.
         * 
         * @param {string} name
         *  The name of the symbol to resolve.
         * @return
         *  The value of the symbol.
         * @error
         *  The symbol could not be resolved.
         */
        private ResolveSymbol(name: string) {
            if (!this.symbols.hasOwnProperty(name))
                throw new Error(`Unresolved symbol ${name}`);
            let symbol = this.symbols[name];
            let value = symbol.Value;
            if (symbol.Label) {
                if (!this.layout.hasOwnProperty(symbol.Section.Name))
                    throw new Error(`No memory layout for section ${symbol.Section.Name}`);
                value = value + this.layout[symbol.Section.Name];
                console.log(`Resolving label ${name} to address ${value.toHex()} ` +
                    `(section ${symbol.Section.Name})`);
            }
            return value;
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
        private BuildInstruction(data: any): number {
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
                relOffset = data.Offset - this.selectedSection.Position - 8,
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
            // H/SH/SB is a different instruction really so dispatch to its own routine.
            if (data.Mode && data.Mode.match(/^H|SH|SB$/))
                return this.BuildInstruction_8(data);
            let cm = this.ConditionMask(data.Condition),
                rd = parseInt(data.Rd.substr(1)),
                p = data.Type == 'Pre' ? 1 : 0,
                w = data.Writeback ? 1 : 0,
                i = data.Immediate ? 0 : 1,
                u = data.Subtract ? 0 : 1,
                l = data.Mnemonic == 'LDR' ? 1 : 0,
                b = (data.Mode == 'B' || data.Mode == 'BT') ? 1 : 0;
            // Resolve pseudo instructions.
            if (data.Pseudo) {
                try {
                    // Build MOV/MVN instruction if value fits into <op2> field.
                    let imm = Util.EncodeImmediate(data.Offset);
                    return this.BuildInstruction_2({
                        Immediate: true,
                        Mnemonic: imm.Negative ? 'MVN' : 'MOV',
                        Condition: data.Condition || null,
                        Op2: imm,
                        Rd: data.Rd
                    });
                } catch (e) {
                    // If R15 is specified as register Rn, the value used is the address of the
                    // instruction plus 8 (the program counter is always 2 instructions ahead of
                    // the instruction currently being executed).
                    var litpool = this.GetNearestLitPool(this.selectedSection.Position);
                    let relOffset = litpool.Put(data.Offset) -
                        (this.selectedSection.Position + 8);
                    if (relOffset < 0) {
                        u = 0; // Subtract offset
                        relOffset *= -1;
                    } else
                        u = 1;
                    // Build LDR Rd, [PC + Offset] instruction.
                    i = w = b = 0;
                    p = 1;
                    data.Source = 'R15';
                    data.Offset = relOffset;
                    data.Type = 'Post';
                }
            }
            // Deal with LDR/STR.
            let mask = 0x4000000,
                rn = parseInt(data.Source.substr(1)),
                offset = data.Offset || 0;
            // Offset is a (possibly shifted) register.
            if (i == 1 && data.Offset) {
                let stypes = { 'LSL': 0, 'LSR': 1, 'ASL': 0, 'ASR': 2, 'ROR': 3 },
                    reg = parseInt(data.Offset.substr(1)),
                    shift = data.Shift ? ((data.Shift << 3) | (stypes[data.ShiftOp] << 1)) : 0;
                offset = (shift << 4) | reg;
            }
            return (cm << 28) | mask | (i << 25) | (p << 24) | (u << 23) | (b << 22) |
                (w << 21) | (l << 20) | (rn << 16) | (rd << 12) | offset;
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