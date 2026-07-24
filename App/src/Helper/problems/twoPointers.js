const TWOPOINTERS_PROBLEMS = [
  {
    "id": "length-of-longest-substring",
    "title": "Longest Substring Without Repeating Characters",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Medium",
    "tags": [
      "string",
      "sliding-window"
    ],
    "description": "Write `lengthOfLongestSubstring(s)` returning the length of the longest substring of `s` without repeating characters.",
    "functionName": "lengthOfLongestSubstring",
    "starterCode": "function lengthOfLongestSubstring(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "abcabcbb"
        ],
        "expected": 3
      },
      {
        "args": [
          "bbbbb"
        ],
        "expected": 1
      },
      {
        "args": [
          "pwwkew"
        ],
        "expected": 3
      },
      {
        "args": [
          ""
        ],
        "expected": 0
      }
    ]
  },
  {
    "id": "two-sum-sorted",
    "title": "Two Sum (Sorted Input)",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Easy",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `twoSumSorted(nums, target)` where `nums` is sorted ascending — return the 1-indexed positions of the two numbers that add up to `target`.",
    "functionName": "twoSumSorted",
    "starterCode": "function twoSumSorted(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            7,
            11,
            15
          ],
          9
        ],
        "expected": [
          1,
          2
        ]
      },
      {
        "args": [
          [
            2,
            3,
            4
          ],
          6
        ],
        "expected": [
          1,
          3
        ]
      },
      {
        "args": [
          [
            -1,
            0
          ],
          -1
        ],
        "expected": [
          1,
          2
        ]
      },
      {
        "args": [
          [
            1,
            2,
            3,
            4,
            4,
            9,
            56,
            90
          ],
          8
        ],
        "expected": [
          4,
          5
        ]
      }
    ]
  },
  {
    "id": "container-with-most-water",
    "title": "Container With Most Water",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Medium",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `maxArea(height)` — given bar heights, return the maximum area of water that can be contained between two bars (area = distance × shorter bar height).",
    "functionName": "maxArea",
    "starterCode": "function maxArea(height) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            8,
            6,
            2,
            5,
            4,
            8,
            3,
            7
          ]
        ],
        "expected": 49
      },
      {
        "args": [
          [
            1,
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            4,
            3,
            2,
            1,
            4
          ]
        ],
        "expected": 16
      },
      {
        "args": [
          [
            1,
            2,
            1
          ]
        ],
        "expected": 2
      }
    ]
  },
  {
    "id": "three-sum",
    "title": "3Sum",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Medium",
    "tags": [
      "array",
      "two-pointers",
      "sorting"
    ],
    "description": "Write `threeSum(nums)` returning all unique triplets `[a, b, c]` from `nums` that sum to zero. Each triplet should be sorted ascending, and the outer array sorted lexicographically by triplet.",
    "functionName": "threeSum",
    "starterCode": "function threeSum(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            -1,
            0,
            1,
            2,
            -1,
            -4
          ]
        ],
        "expected": [
          [
            -1,
            -1,
            2
          ],
          [
            -1,
            0,
            1
          ]
        ]
      },
      {
        "args": [
          [
            0,
            1,
            1
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [
            0,
            0,
            0
          ]
        ],
        "expected": [
          [
            0,
            0,
            0
          ]
        ]
      },
      {
        "args": [
          [
            -2,
            0,
            0,
            2,
            2
          ]
        ],
        "expected": [
          [
            -2,
            0,
            2
          ]
        ]
      }
    ]
  },
  {
    "id": "max-sum-subarray-size-k",
    "title": "Max Sum Subarray of Size K",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Easy",
    "tags": [
      "array",
      "sliding-window"
    ],
    "description": "Write `maxSumSubarrayOfSizeK(nums, k)` returning the maximum sum of any contiguous subarray of exactly length `k`.",
    "functionName": "maxSumSubarrayOfSizeK",
    "starterCode": "function maxSumSubarrayOfSizeK(nums, k) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            1,
            5,
            1,
            3,
            2
          ],
          3
        ],
        "expected": 9
      },
      {
        "args": [
          [
            2,
            3,
            4,
            1,
            5
          ],
          2
        ],
        "expected": 7
      },
      {
        "args": [
          [
            1,
            1,
            1,
            1
          ],
          4
        ],
        "expected": 4
      },
      {
        "args": [
          [
            5,
            2,
            -1,
            0,
            3
          ],
          2
        ],
        "expected": 7
      }
    ]
  },
  {
    "id": "min-subarray-len",
    "title": "Minimum Size Subarray Sum",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Medium",
    "tags": [
      "array",
      "sliding-window"
    ],
    "description": "Write `minSubArrayLen(nums, target)` returning the minimal length of a contiguous subarray whose sum is ≥ `target` (all values positive). Return 0 if no such subarray exists.",
    "functionName": "minSubArrayLen",
    "starterCode": "function minSubArrayLen(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            3,
            1,
            2,
            4,
            3
          ],
          7
        ],
        "expected": 2
      },
      {
        "args": [
          [
            1,
            4,
            4
          ],
          4
        ],
        "expected": 1
      },
      {
        "args": [
          [
            1,
            1,
            1,
            1
          ],
          11
        ],
        "expected": 0
      },
      {
        "args": [
          [
            1,
            2,
            3,
            4,
            5
          ],
          11
        ],
        "expected": 3
      }
    ]
  },
  {
    "id": "find-anagrams-in-string",
    "title": "Find All Anagrams in a String",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Medium",
    "tags": [
      "string",
      "sliding-window"
    ],
    "description": "Write `findAnagrams(s, p)` returning all starting indices in `s` where a substring is an anagram of `p`.",
    "functionName": "findAnagrams",
    "starterCode": "function findAnagrams(s, p) {\n  \n}",
    "testCases": [
      {
        "args": [
          "cbaebabacd",
          "abc"
        ],
        "expected": [
          0,
          6
        ]
      },
      {
        "args": [
          "abab",
          "ab"
        ],
        "expected": [
          0,
          1,
          2
        ]
      },
      {
        "args": [
          "af",
          "be"
        ],
        "expected": []
      },
      {
        "args": [
          "a",
          "a"
        ],
        "expected": [
          0
        ]
      }
    ]
  },
  {
    "id": "reverse-vowels",
    "title": "Reverse Vowels of a String",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Easy",
    "tags": [
      "string",
      "two-pointers"
    ],
    "description": "Write `reverseVowels(s)` returning `s` with only the vowels (a, e, i, o, u — either case) reversed in place; consonants stay where they are.",
    "functionName": "reverseVowels",
    "starterCode": "function reverseVowels(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "hello"
        ],
        "expected": "holle"
      },
      {
        "args": [
          "leetcode"
        ],
        "expected": "leotcede"
      },
      {
        "args": [
          "aA"
        ],
        "expected": "Aa"
      },
      {
        "args": [
          "xyz"
        ],
        "expected": "xyz"
      }
    ]
  },
  {
    "id": "sort-colors",
    "title": "Sort Colors",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Medium",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `sortColors(nums)` — given an array containing only 0, 1, and 2, return it sorted (Dutch national flag problem).",
    "functionName": "sortColors",
    "starterCode": "function sortColors(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            0,
            2,
            1,
            1,
            0
          ]
        ],
        "expected": [
          0,
          0,
          1,
          1,
          2,
          2
        ]
      },
      {
        "args": [
          [
            2,
            0,
            1
          ]
        ],
        "expected": [
          0,
          1,
          2
        ]
      },
      {
        "args": [
          [
            0
          ]
        ],
        "expected": [
          0
        ]
      },
      {
        "args": [
          [
            1,
            2,
            0,
            2,
            1,
            0,
            0
          ]
        ],
        "expected": [
          0,
          0,
          0,
          1,
          1,
          2,
          2
        ]
      }
    ]
  },
  {
    "id": "backspace-string-compare",
    "title": "Backspace String Compare",
    "category": "Two Pointers & Sliding Window",
    "difficulty": "Easy",
    "tags": [
      "string",
      "stack"
    ],
    "description": "Write `backspaceCompare(s, t)` — treating `#` as a backspace character in both strings, return true if the resulting strings are equal.",
    "functionName": "backspaceCompare",
    "starterCode": "function backspaceCompare(s, t) {\n  \n}",
    "testCases": [
      {
        "args": [
          "ab#c",
          "ad#c"
        ],
        "expected": true
      },
      {
        "args": [
          "ab##",
          "c#d#"
        ],
        "expected": true
      },
      {
        "args": [
          "a#c",
          "b"
        ],
        "expected": false
      },
      {
        "args": [
          "a##c",
          "#a#c"
        ],
        "expected": true
      }
    ]
  }
];

export default TWOPOINTERS_PROBLEMS;
