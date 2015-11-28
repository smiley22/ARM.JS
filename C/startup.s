@ startup code
@ placed at the very beginning of the .text section by the linker

.arm
.section .text
.global _startup
.func   _startup

_startup:

@
@ Exception vectors are located at 0x00 - 0x1C
@
B ResetException
B UndefinedException
B SoftwareException
B PrefetchException
B DataException
NOP
B IRQException
B FIQException

UndefinedException: B UndefinedException
SoftwareException:  B SoftwareException
PrefetchException:  B PrefetchException
DataException:      B DataException
IRQException:       B IRQException
FIQException:       B FIQException

@
@ Setup stack, enable interrupts and enter C main
@
ResetException:

@ Internal RAM definitions
.equ    SYS_CALL, 0xFFFFFFFF
.equ    SYS_HALT, 0x01
.equ    RAM_Size, 0x00001000            @ => 4kB
.equ    RAM_Base, 0x00040000  
.equ    TopStack, RAM_Base + RAM_Size   @ => Stack grows from top down towards data segment

ldr  r0,  =TopStack
mov  r13, r0  @ R13 acts as stack pointer by convention

@ Enter C main
bl  main

@ Halt simulation
ldr r0, =SYS_CALL
ldr r1, =SYS_HALT
strb r1, [r0]
.end
