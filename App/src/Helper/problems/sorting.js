const SORTING_PROBLEMS = [
  {
    "id": "binary-search",
    "title": "Binary Search",
    "category": "Sorting & Searching",
    "difficulty": "Easy",
    "tags": [
      "binary-search"
    ],
    "description": "Write `binarySearch(nums, target)` on a sorted array, returning the index of `target` or `-1` if not found.",
    "functionName": "binarySearch",
    "starterCode": "function binarySearch(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            -1,
            0,
            3,
            5,
            9,
            12
          ],
          9
        ],
        "expected": 4
      },
      {
        "args": [
          [
            -1,
            0,
            3,
            5,
            9,
            12
          ],
          2
        ],
        "expected": -1
      },
      {
        "args": [
          [
            5
          ],
          5
        ],
        "expected": 0
      },
      {
        "args": [
          [],
          1
        ],
        "expected": -1
      }
    ]
  },
  {
    "id": "search-insert-position",
    "title": "Search Insert Position",
    "category": "Sorting & Searching",
    "difficulty": "Easy",
    "tags": [
      "binary-search"
    ],
    "description": "Write `searchInsert(nums, target)` — return the index of `target` in the sorted array `nums`, or the index where it would be inserted to keep it sorted.",
    "functionName": "searchInsert",
    "starterCode": "function searchInsert(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            3,
            5,
            6
          ],
          5
        ],
        "expected": 2
      },
      {
        "args": [
          [
            1,
            3,
            5,
            6
          ],
          2
        ],
        "expected": 1
      },
      {
        "args": [
          [
            1,
            3,
            5,
            6
          ],
          7
        ],
        "expected": 4
      },
      {
        "args": [
          [
            1,
            3,
            5,
            6
          ],
          0
        ],
        "expected": 0
      }
    ]
  },
  {
    "id": "search-range",
    "title": "Find First and Last Position",
    "category": "Sorting & Searching",
    "difficulty": "Medium",
    "tags": [
      "binary-search"
    ],
    "description": "Write `searchRange(nums, target)` returning `[first, last]` indices of `target` in the sorted array `nums`, or `[-1, -1]` if not present.",
    "functionName": "searchRange",
    "starterCode": "function searchRange(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            5,
            7,
            7,
            8,
            8,
            10
          ],
          8
        ],
        "expected": [
          3,
          4
        ]
      },
      {
        "args": [
          [
            5,
            7,
            7,
            8,
            8,
            10
          ],
          6
        ],
        "expected": [
          -1,
          -1
        ]
      },
      {
        "args": [
          [],
          0
        ],
        "expected": [
          -1,
          -1
        ]
      },
      {
        "args": [
          [
            1
          ],
          1
        ],
        "expected": [
          0,
          0
        ]
      }
    ]
  },
  {
    "id": "merge-sorted-arrays",
    "title": "Merge Sorted Arrays",
    "category": "Sorting & Searching",
    "difficulty": "Easy",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `mergeSortedArrays(a, b)` merging two sorted arrays into one sorted array.",
    "functionName": "mergeSortedArrays",
    "starterCode": "function mergeSortedArrays(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            3,
            5
          ],
          [
            2,
            4,
            6
          ]
        ],
        "expected": [
          1,
          2,
          3,
          4,
          5,
          6
        ]
      },
      {
        "args": [
          [],
          [
            1
          ]
        ],
        "expected": [
          1
        ]
      },
      {
        "args": [
          [
            1,
            2,
            3
          ],
          []
        ],
        "expected": [
          1,
          2,
          3
        ]
      },
      {
        "args": [
          [
            -5,
            0,
            3
          ],
          [
            -2,
            2,
            4
          ]
        ],
        "expected": [
          -5,
          -2,
          0,
          2,
          3,
          4
        ]
      }
    ]
  },
  {
    "id": "kth-largest-element",
    "title": "Kth Largest Element",
    "category": "Sorting & Searching",
    "difficulty": "Medium",
    "tags": [
      "sorting"
    ],
    "description": "Write `findKthLargest(nums, k)` returning the `k`-th largest element in the array (1st largest = maximum).",
    "functionName": "findKthLargest",
    "starterCode": "function findKthLargest(nums, k) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            3,
            2,
            1,
            5,
            6,
            4
          ],
          2
        ],
        "expected": 5
      },
      {
        "args": [
          [
            3,
            2,
            3,
            1,
            2,
            4,
            5,
            5,
            6
          ],
          4
        ],
        "expected": 4
      },
      {
        "args": [
          [
            1
          ],
          1
        ],
        "expected": 1
      },
      {
        "args": [
          [
            7,
            6,
            5,
            4,
            3,
            2,
            1
          ],
          1
        ],
        "expected": 7
      }
    ]
  },
  {
    "id": "sort-by-parity",
    "title": "Sort Array By Parity",
    "category": "Sorting & Searching",
    "difficulty": "Easy",
    "tags": [
      "array",
      "sorting"
    ],
    "description": "Write `sortByParity(nums)` returning a new array with all even numbers first, then all odd numbers, each group keeping its original relative order.",
    "functionName": "sortByParity",
    "starterCode": "function sortByParity(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            3,
            1,
            2,
            4
          ]
        ],
        "expected": [
          2,
          4,
          3,
          1
        ]
      },
      {
        "args": [
          [
            0,
            1,
            2
          ]
        ],
        "expected": [
          0,
          2,
          1
        ]
      },
      {
        "args": [
          [
            1,
            3,
            5
          ]
        ],
        "expected": [
          1,
          3,
          5
        ]
      },
      {
        "args": [
          [
            4,
            2,
            0
          ]
        ],
        "expected": [
          4,
          2,
          0
        ]
      }
    ]
  },
  {
    "id": "find-peak-element",
    "title": "Find Peak Element",
    "category": "Sorting & Searching",
    "difficulty": "Medium",
    "tags": [
      "binary-search"
    ],
    "description": "Write `findPeakElement(nums)` returning the index of *a* peak element (strictly greater than its neighbors; edges compare only to their one neighbor). Use binary search: at each step compare `nums[mid]` to `nums[mid+1]` and move toward the larger side.",
    "functionName": "findPeakElement",
    "starterCode": "function findPeakElement(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3,
            1
          ]
        ],
        "expected": 2
      },
      {
        "args": [
          [
            1,
            2,
            1,
            3,
            5,
            6,
            4
          ]
        ],
        "expected": 5
      },
      {
        "args": [
          [
            1
          ]
        ],
        "expected": 0
      },
      {
        "args": [
          [
            1,
            2
          ]
        ],
        "expected": 1
      }
    ]
  },
  {
    "id": "search-rotated-sorted-array",
    "title": "Search in Rotated Sorted Array",
    "category": "Sorting & Searching",
    "difficulty": "Medium",
    "tags": [
      "binary-search"
    ],
    "description": "Write `searchRotated(nums, target)` — `nums` was sorted then rotated at an unknown pivot. Return the index of `target`, or `-1` if not present.",
    "functionName": "searchRotated",
    "starterCode": "function searchRotated(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            4,
            5,
            6,
            7,
            0,
            1,
            2
          ],
          0
        ],
        "expected": 4
      },
      {
        "args": [
          [
            4,
            5,
            6,
            7,
            0,
            1,
            2
          ],
          3
        ],
        "expected": -1
      },
      {
        "args": [
          [
            1
          ],
          0
        ],
        "expected": -1
      },
      {
        "args": [
          [
            5,
            1,
            3
          ],
          5
        ],
        "expected": 0
      }
    ]
  },
  {
    "id": "sorted-squares",
    "title": "Squares of a Sorted Array",
    "category": "Sorting & Searching",
    "difficulty": "Easy",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `sortedSquares(nums)` — given `nums` sorted ascending (may include negatives), return an array of the squares of each number, sorted ascending.",
    "functionName": "sortedSquares",
    "starterCode": "function sortedSquares(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            -4,
            -1,
            0,
            3,
            10
          ]
        ],
        "expected": [
          0,
          1,
          9,
          16,
          100
        ]
      },
      {
        "args": [
          [
            -7,
            -3,
            2,
            3,
            11
          ]
        ],
        "expected": [
          4,
          9,
          9,
          49,
          121
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
            -5,
            -3,
            -1
          ]
        ],
        "expected": [
          1,
          9,
          25
        ]
      }
    ]
  },
  {
    "id": "h-index",
    "title": "H-Index",
    "category": "Sorting & Searching",
    "difficulty": "Medium",
    "tags": [
      "sorting",
      "array"
    ],
    "description": "Write `hIndex(citations)` returning a researcher's h-index: the largest `h` such that at least `h` papers have ≥ `h` citations each.",
    "functionName": "hIndex",
    "starterCode": "function hIndex(citations) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            3,
            0,
            6,
            1,
            5
          ]
        ],
        "expected": 3
      },
      {
        "args": [
          [
            1,
            3,
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            0,
            0,
            0
          ]
        ],
        "expected": 0
      },
      {
        "args": [
          [
            100,
            8,
            7,
            5
          ]
        ],
        "expected": 4
      }
    ]
  }
];

export default SORTING_PROBLEMS;
