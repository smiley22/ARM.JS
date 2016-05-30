module ARM.Assembler {
    /**
     * A quick fix for a strongly-typed hash-table.
     */
    export interface HashTable<T> {
        [key: string]: T;
    }
}