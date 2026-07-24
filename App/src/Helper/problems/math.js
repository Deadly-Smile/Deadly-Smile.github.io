const MATH_PROBLEMS = [
  {
    "id": "is-prime",
    "title": "Is Prime",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "math"
    ],
    "description": "Write `isPrime(n)` returning true if `n` is a prime number (`n` ≥ 0).",
    "functionName": "isPrime",
    "starterCode": "function isPrime(n) {\n  \n}",
    "testCases": [
      {
        "args": [
          2
        ],
        "expected": true
      },
      {
        "args": [
          17
        ],
        "expected": true
      },
      {
        "args": [
          1
        ],
        "expected": false
      },
      {
        "args": [
          100
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "gcd",
    "title": "Greatest Common Divisor",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "math"
    ],
    "description": "Write `gcd(a, b)` returning the greatest common divisor of two non-negative integers.",
    "functionName": "gcd",
    "starterCode": "function gcd(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          48,
          18
        ],
        "expected": 6
      },
      {
        "args": [
          17,
          5
        ],
        "expected": 1
      },
      {
        "args": [
          0,
          5
        ],
        "expected": 5
      },
      {
        "args": [
          100,
          75
        ],
        "expected": 25
      }
    ]
  },
  {
    "id": "count-set-bits",
    "title": "Count Set Bits",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "bit-manipulation"
    ],
    "description": "Write `countSetBits(n)` returning the number of `1` bits in the binary representation of the non-negative integer `n`.",
    "functionName": "countSetBits",
    "starterCode": "function countSetBits(n) {\n  \n}",
    "testCases": [
      {
        "args": [
          11
        ],
        "expected": 3
      },
      {
        "args": [
          128
        ],
        "expected": 1
      },
      {
        "args": [
          0
        ],
        "expected": 0
      },
      {
        "args": [
          255
        ],
        "expected": 8
      }
    ]
  },
  {
    "id": "single-number-xor",
    "title": "Single Number (XOR)",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "bit-manipulation"
    ],
    "description": "Write `singleNumberXor(nums)` — every element appears twice except one; find it using XOR (no extra data structure).",
    "functionName": "singleNumberXor",
    "starterCode": "function singleNumberXor(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            4,
            1,
            2,
            1,
            2
          ]
        ],
        "expected": 4
      },
      {
        "args": [
          [
            2,
            2,
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            7,
            3,
            5,
            3,
            5
          ]
        ],
        "expected": 7
      }
    ]
  },
  {
    "id": "reverse-integer",
    "title": "Reverse Integer",
    "category": "Math & Bit Manipulation",
    "difficulty": "Medium",
    "tags": [
      "math"
    ],
    "description": "Write `reverseInteger(x)` reversing the digits of a signed 32-bit integer `x`. Return `0` if the reversed value overflows a 32-bit signed integer range.",
    "functionName": "reverseInteger",
    "starterCode": "function reverseInteger(x) {\n  \n}",
    "testCases": [
      {
        "args": [
          123
        ],
        "expected": 321
      },
      {
        "args": [
          -123
        ],
        "expected": -321
      },
      {
        "args": [
          120
        ],
        "expected": 21
      },
      {
        "args": [
          1534236469
        ],
        "expected": 0
      }
    ]
  },
  {
    "id": "power-of-two",
    "title": "Power of Two",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "bit-manipulation"
    ],
    "description": "Write `isPowerOfTwo(n)` returning true if `n` is a power of two (`1, 2, 4, 8, ...`).",
    "functionName": "isPowerOfTwo",
    "starterCode": "function isPowerOfTwo(n) {\n  \n}",
    "testCases": [
      {
        "args": [
          1
        ],
        "expected": true
      },
      {
        "args": [
          16
        ],
        "expected": true
      },
      {
        "args": [
          3
        ],
        "expected": false
      },
      {
        "args": [
          0
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "fizzbuzz",
    "title": "FizzBuzz",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "math"
    ],
    "description": "Write `fizzBuzz(n)` returning an array of strings for `1..n`: multiples of 3 → `\"Fizz\"`, multiples of 5 → `\"Buzz\"`, multiples of both → `\"FizzBuzz\"`, otherwise the number as a string.",
    "functionName": "fizzBuzz",
    "starterCode": "function fizzBuzz(n) {\n  \n}",
    "testCases": [
      {
        "args": [
          15
        ],
        "expected": [
          "1",
          "2",
          "Fizz",
          "4",
          "Buzz",
          "Fizz",
          "7",
          "8",
          "Fizz",
          "Buzz",
          "11",
          "Fizz",
          "13",
          "14",
          "FizzBuzz"
        ]
      },
      {
        "args": [
          5
        ],
        "expected": [
          "1",
          "2",
          "Fizz",
          "4",
          "Buzz"
        ]
      },
      {
        "args": [
          1
        ],
        "expected": [
          "1"
        ]
      },
      {
        "args": [
          3
        ],
        "expected": [
          "1",
          "2",
          "Fizz"
        ]
      }
    ]
  },
  {
    "id": "add-binary",
    "title": "Add Binary",
    "category": "Math & Bit Manipulation",
    "difficulty": "Easy",
    "tags": [
      "math",
      "string"
    ],
    "description": "Write `addBinary(a, b)` adding two binary strings and returning the sum as a binary string.",
    "functionName": "addBinary",
    "starterCode": "function addBinary(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          "11",
          "1"
        ],
        "expected": "100"
      },
      {
        "args": [
          "1010",
          "1011"
        ],
        "expected": "10101"
      },
      {
        "args": [
          "0",
          "0"
        ],
        "expected": "0"
      },
      {
        "args": [
          "1111",
          "1111"
        ],
        "expected": "11110"
      }
    ]
  }
];

export default MATH_PROBLEMS;
