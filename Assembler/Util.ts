module ARM.Assembler {
    /**
     * Provides a couple of plumbing and utility methods.
     */
    export class Util {
        /**
         * Strips all comments from the specified text. Based on code written by James Padolsey.
         * 
         * @param {string} text
         *  The text to strip comments from.
         * @return {string}
         *  The input text stripped of all comments.
         * @remarks
         *  The following comment notations are supported:
         *    Single line:
         *      # This is a comment (only at start of line)
         *      ; This is a comment
         *      @ This is a comment
         *    Block:
         *      C99/C++/JS Block-style comments.
         */
        static StripComments(text: string) {
            var str = (`__${text}__`).split('');
            var mode = {
                singleQuote: false, doubleQuote: false,
                blockComment: false, lineComment: false
            };
            for (var i = 0, l = str.length; i < l; i++) {
                if (mode.singleQuote) {
                    if (str[i] === "'" && str[i - 1] !== '\\')
                        mode.singleQuote = false;
                    continue;
                }
                if (mode.doubleQuote) {
                    if (str[i] === '"' && str[i - 1] !== '\\')
                        mode.doubleQuote = false;
                    continue;
                }
                if (mode.blockComment) {
                    if (str[i] === '*' && str[i + 1] === '/') {
                        str[i + 1] = '';
                        mode.blockComment = false;
                    }
                    str[i] = '';
                    continue;
                }
                if (mode.lineComment) {
                    if (str[i + 1] === '\n' || str[i + 1] === '\r')
                        mode.lineComment = false;
                    else if (str[i] === '\n' || str[i] === '\r')
                        mode.lineComment = false;

                    str[i] = '';
                    continue;
                }
                mode.doubleQuote = str[i] === '"';
                mode.singleQuote = str[i] === "'";

                if (str[i] === '/') {
                    if (str[i + 1] === '*') {
                        str[i] = '';
                        mode.blockComment = true;
                        continue;
                    }
                }
                else if (str[i] === '@' || str[i] === ';') {
                    str[i] = '';
                    mode.lineComment = true;
                    continue;
                }
                else if (str[i] === '#') {
                    var empty = true;
                    for (var c = i - 1; c >= 2 /* account for first 2 __  characters */; c--) {
                        if (str[c] == '\n')
                            break;
                        if (str[c] != '' && str[c] != ' ' && str[c] != '\t') {
                            empty = false;
                            break;
                        }
                    }
                    if (empty) {
                        str[i] = '';
                        mode.lineComment = true;
                        continue;
                    }
                }
            }
            return str.join('').slice(2, -2);
        }

        /**
         * Merges the properties of the specified objects into a new object.
         * 
         * @param {Object} a
         *  The first object.
         * @param {Object} b
         *  The second object.
         * @return {Object}
         *  An object with all properties of the input objects.
         */
        static MergeObjects(a: Object, b: Object) {
            var ret = {};
            for (let i in a)
                ret[i] = a[i];
            for (let i in b)
                ret[i] = b[i];
            return ret;
        }

        /**
         * Determines whether the specified operand is an ARM register identifier.
         * 
         * @param op
         *  The operand to test.
         * @return {boolean}
         *  true if the specified operand is an ARM register identifier; otherwise false.
         */
        static IsRegister(op: any) {
            if (typeof (op) != 'string' || op.length < 2)
                return false;
            return op[0] == 'R';
        }

        /**
         * Encodes the specified 32-bit value as a rotated immediate operand as is used by
         * the set of ARM data processcing instructions.
         * 
         * @param {number} value
         *  The 32-bit value to encode.
         * @return
         *  An object containing an 8-bit immediate value as well as a 4-bit unsigned rotate
         *  value.
         * @throws Error
         *  The specified 32-bit value cannot be encoded as an immediate constant.
         * @remarks
         *  For details, consult ARM7TDMI-S Data Sheet, 4.5.3.
         */
        static EncodeImmediate(value: number): { Immediate: number, Rotate: number, Negative: boolean } {
            function rotateRight(v: number, n: number) {
                for (let i = 0; i < n; i++)
                    v = (v >>> 1) | ((v & 0x01) << 31);
                return v;
            }
            var m = ((value >>> 31) & 0x01) ? true : false;
            if (m)
                value = ~value; /* peform logical not and use MVN instead of MOV */
            var l = null;
            for (let i = 0; i < 16; i++) {
                value = rotateRight(value, 2);
                if (value >= 0 && value < 256)
                    l = { Immediate: value, Rotate: (15 - i), Negative: m };
            }
            if (l == null)
                throw new Error(`invalid constant 0x${Math.abs(value).toString(16)}`);
            return l;
        }
    }
}