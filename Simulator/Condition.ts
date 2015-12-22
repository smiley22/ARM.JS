module ARM.Simulator {
    /**
     * The conditions one of which can be specified in the 4-bit condition code field in bits
     * 31 to 28 of each ARMv4T instruction.
     *
     * @remarks
     *  Conveniently TypeScript enums begin numbering starting at 0 so we don't have to explicitly
     *  number the conditions.
     */
    export enum Condition {
        /**
         * Equal.
         */
        EQ,

        /**
         * Not equal.
         */
        NE,

        /**
         * Carry set/unsigned higher or same.
         */
        CS,

        /**
         * Carry clear/unsigned lower.
         */
        CC,

        /**
         * Minus/negative.
         */
        MI,

        /**
         * Plus/positive or zero.
         */
        PL,

        /**
         * Overflow.
         */
        VS,

        /**
         * No overflow.
         */
        VC,

        /**
         * Unsigned higher.
         */
        HI,

        /**
         * Unsigned lower or same.
         */
        LS,

        /**
         * Signed greater than or equal.
         */
        GE,

        /**
         * Signed less than.
         */
        LT,

        /**
         * Signed greater than.
         */
        GT,

        /**
         * Signed less than or equal.
         */
        LE,

        /**
         * Always (unconditional).
         */
        AL,

        /**
         * Never (unpredictable in ARMv4T).
         */
        NV
    }
}