const SNIPPETS = {
    javascript: [
        {
            label: "Hello World",
            code: `console.log("Hello, World!");`
        },
        {
            label: "Array methods",
            code: `const nums = [1, 2, 3, 4, 5];
console.log("doubled:", nums.map(n => n * 2));
console.log("evens:", nums.filter(n => n % 2 === 0));
console.log("sum:", nums.reduce((a, b) => a + b, 0));`
        },
        {
            label: "Async / fetch",
            code: `const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
const data = await res.json();
console.log(data);`
        },
        {
            label: "Classes",
            code: `class Animal {
    constructor(name) {
        this.name = name;
    }

    speak() {
        return \`\${this.name} makes a sound.\`;
    }
}

class Dog extends Animal {
    speak() {
        return \`\${this.name} barks!\`;
    }
}

console.log(new Dog("Rex").speak());`
        },
        {
            label: "Timer / perf",
            code: `const t0 = performance.now();

let x = 0;
for (let i = 0; i < 1_000_000; i++) {
    x += i;
}

console.log("Result:", x);
console.log(\`Took \${(performance.now() - t0).toFixed(2)}ms\`);`
        }
    ],

    cpp: [
        {
            label: "Hello World",
            code: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`
        },
        {
            label: "Variables & Math",
            code: `#include <iostream>
using namespace std;

int main() {
    int a = 10, b = 20;

    cout << "a=" << a << ", b=" << b << endl;
    cout << "a+b=" << (a + b) << endl;
    cout << "a*b=" << (a * b) << endl;

    return 0;
}`
        },
        {
            label: "Arrays & Loops",
            code: `#include <iostream>
using namespace std;

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    int sum = 0;

    for (int i = 0; i < 5; i++) {
        sum += arr[i];
    }

    cout << "Sum: " << sum << endl;
    cout << "Average: " << sum / 5.0 << endl;

    return 0;
}`
        },
        {
            label: "Functions",
            code: `#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    cout << "5! = " << factorial(5) << endl;
    cout << "10! = " << factorial(10) << endl;
    return 0;
}`
        },
        {
            label: "Strings",
            code: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name = "World";
    cout << "Hello, " << name << "!" << endl;

    string s = "C++";
    cout << "Length: " << s.length() << endl;

    for (char c : s) {
        cout << c << " ";
    }

    cout << endl;
    return 0;
}`
        }
    ]
};

export default SNIPPETS;