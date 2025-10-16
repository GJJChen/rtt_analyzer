# gen_rtt_csv.py
import argparse
import csv
import os
import numpy as np

def generate_rtt_samples(n=10000, seed=42, median_ms=30.0, sigma=0.5, outlier_rate=0.005):
    np.random.seed(seed)
    median_sec = median_ms / 1000.0
    mu = np.log(median_sec)  # 对数正态分布的中位数为 exp(mu)
    data = np.random.lognormal(mean=mu, sigma=sigma, size=n)

    # 注入少量离群值（200ms~500ms）
    k = max(1, int(n * outlier_rate))
    idx = np.random.choice(n, size=k, replace=False)
    data[idx] = np.random.uniform(1.0, 1.9, size=k)

    # 限幅到 [0.001s, 2.0s] 以避免极端值
    data = np.clip(data, 0.001, 2.5)
    return data

def write_csv(path, values_sec):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["RTT"])
        for v in values_sec:
            w.writerow([f"{v:.6f}"])  # 保留 6 位小数（秒）

def main():
    parser = argparse.ArgumentParser(description="Generate RTT CSV for testing (column: RTT in seconds).")
    parser.add_argument("-o", "--out", default="sample_rtt.csv", help="Output CSV path")
    parser.add_argument("-n", "--num", type=int, default=10000, help="Number of RTT samples")
    parser.add_argument("--median-ms", type=float, default=30.0, help="Median RTT in milliseconds")
    parser.add_argument("--sigma", type=float, default=0.5, help="Lognormal sigma")
    parser.add_argument("--outlier-rate", type=float, default=0.005, help="Outlier ratio (0~1)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    data = generate_rtt_samples(
        n=args.num,
        seed=args.seed,
        median_ms=args.median_ms,
        sigma=args.sigma,
        outlier_rate=args.outlier_rate,
    )
    write_csv(args.out, data)
    print(f"CSV 已生成: {args.out}（{args.num} 条，列名 `RTT`，单位秒）")

if __name__ == "__main__":
    main()
