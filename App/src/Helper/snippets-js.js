// JavaScript code snippets for CodeRunnerTool
const SNIPPETS_JS = [
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
];

export default SNIPPETS_JS;
