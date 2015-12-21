/**
  * Extends the Number type.
  */
interface Number {
    /**
     * Returns an unsigned 32-bit number.
     */
    toUint32(): number
}

/**
  *	Returns an unsigned 32-bit number.
  *
  *	Javascript stores all numbers as double values. Using
  *	bitwise operations is achieved by internally converting back
  *	and forth between double and integer representations. Also
  *	all bitwise operations but >>> will return signed numbers.
  *
  *	var A = 0x80000000		(Positive value)
  *	var B = A & 0xFFFFFFFF	(Negative value, not what we want)
  *
  * @param {number} x
  *	value to convert
  *
  * @return {number}
  *	Returns an unsigned 32-bit number.
  */
Number.prototype.toUint32 = function () {
    return this >>> 0;
}
