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

zerobss:
@ clear bss area
mov r0, #0
ldr r1, =__bss_start__
ldr r2, =__bss_end__
l1:
  cmp r1, r2
  beq l2
  strb r0, [r1], #1
  b l1

l2:
.equ    POWER_CONTROL_REG,    0xE01FC000
.equ    RAM_Size,             0x00008000            @ => 32kB
.equ    RAM_Base,             0x00400000  
.equ    TopStack,             RAM_Base + RAM_Size   @ => Stack grows from top down towards data segment

ldr  r0,  =TopStack
mov  r13, r0  @ R13 acts as stack pointer by convention

@ Enter C main
bl  main

@ halts execution
_exit:
  @ power is turned off by setting bit 1
  ldr r0, =POWER_CONTROL_REG
  mov r1, #1
  strb r1, [r0]
.end
