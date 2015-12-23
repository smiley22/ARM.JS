this.Decode = function (iw) {
    switch ((iw >> 25) & 0x07) {
        case 0:
            if (!(((iw >> 4) & 0x1FFFFF) ^ 0x12FFF1))
                return 'bx';
            var b74 = (iw >> 4) & 0xF;
            if (b74 == 9)
                return ((iw >> 24) & 0x01) ? 'swp' : 'mul_mla_mull_mlal';
            if (b74 == 0xB || b74 == 0xD || b74 == 0xF)
                return 'ldrh_strh_ldrsb_ldrsh';
            if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
                return 'psr';
            return 'data';
        case 1:
            if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
                return 'psr';
            return 'data';
        case 2: return 'ldr_str';
        case 3: return ((iw >> 4) & 0x01) ? 'undefined' : 'ldr_str';
        case 4: return 'ldm_stm';
        case 5: return 'b_bl';
        case 6: return 'ldc_stc';
        case 7:
            if ((iw >> 24) & 0x01)
                return 'swi';
            return ((iw >> 4) & 0x01) ? 'mrc_mcr' : 'cdp';
    }
}
