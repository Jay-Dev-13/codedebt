class calc {
    constructor() {}

    public static Add(x,y) {
        return x+y
    }

    public static sub(x: any, y: any) {
        var result = x - y;
        return result;
    }

    public static multiply(a,b) {
                                    let temp = a;
                                    let result = 0;
        for(let i = 0; i < b; i++) {
            result = result + temp;
        }
        return result;
    }
} 