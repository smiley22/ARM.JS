class foo {
    private myValue: number;
    constructor() {
        this.myValue = 123;
    }
    bar(bla: number): number {
        console.log('foobar ' + bla + " und " + this.myValue);

        return 911;
    }
}

var witz = new foo();


class proz {
    /**
     * Bla blub.
     */
    private myRead: (addr: number) => number;
    constructor(
        read: (addr: number) => number
    ) {
        this.myRead = read;
    }

    doSomeReading(bla: number) {
        var r = this.myRead(12);
        console.log("The read returned " + r);
    }
}

var cpu = new proz(lol => witz.bar(lol));

cpu.doSomeReading(567);