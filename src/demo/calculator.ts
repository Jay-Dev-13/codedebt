// This is a demo file with intentional code debt issues
class calc {
    constructor() {}

    // performs addition
    public static Add(x,y) {
        return x+y
    }

    // subtracts numbers
    public static sub(x: any, y: any) {
        var result = x - y;
        return result;
    }

    public static multiply(a,b) {
        let temp = a;
        let result = 0;
        // multiply using addition
        for(let i = 0; i < b; i++) {
            result = result + temp;
        }
        return result;
    }
} 