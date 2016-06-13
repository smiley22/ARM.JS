module ARM.Assembler {
    /**
     * A poor man's implementation of a strongly-typed hash-table.
     */
    export interface HashTable<T> {
        [key: string]: T;
    }
}