STARTUP(startup.o)

SECTIONS {
    . = 0x00;
    .text : {
        *(.text)
        *(.text.*)
    }
    PROVIDE(__etext = .);
    PROVIDE(_etext = .);
    PROVIDE(etext = .);
    
    . = 0x40000;
    /* Static data.  */
    .rodata : {
        *(.rodata)
        *(.rodata.*)
    }
    
    .data : {
        __data_start = . ;
        *(.data)
        *(.data.*)
    }
     _edata = .;
     PROVIDE(edata = .);
     
     __bss_start = .;
     __bss_start__ = .;
     /* Uninitialized data.  */
    .bss : {
        *(.bss)
        *(.bss.*)
    }
    __bss_end__ = .;
    _bss_end__ = .;

    . = ALIGN(4);
    __end = .;
    _end = .;
    PROVIDE(end = .);
}