"""Script to generate realistic, self-contained sample datasets for Infera.

Generates:
1. housing.csv - Regression (price prediction)
2. customer_churn.csv - Binary classification (churn prediction)
3. student_performance.csv - Multiclass classification & regression
4. retail_sales.csv - Time series / Sales analytics
"""

import csv
import math
import random
from datetime import date, timedelta
from pathlib import Path

SAMPLE_DIR = Path(__file__).parent
random.seed(42)


def generate_housing(n=250):
    rows = []
    neighborhoods = ["Downtown", "Suburbs", "Riverside", "Hillside", "Uptown"]
    conditions = ["Poor", "Fair", "Good", "Excellent"]

    for i in range(n):
        bedrooms = random.randint(1, 5)
        bathrooms = round(random.choice([1.0, 1.5, 2.0, 2.5, 3.0, 3.5]), 1)
        sqft = random.randint(700, 4200)
        lot_size = random.randint(1500, 15000)
        floors = random.choice([1, 1, 2, 2, 3])
        waterfront = 1 if random.random() < 0.08 else 0
        year_built = random.randint(1960, 2024)
        neighborhood = random.choice(neighborhoods)
        condition = random.choice(conditions)

        # Realistic price generation based on features
        base = 80000
        n_mult = {"Downtown": 1.45, "Riverside": 1.35, "Uptown": 1.25, "Suburbs": 1.0, "Hillside": 1.15}[neighborhood]
        cond_add = {"Poor": -25000, "Fair": 0, "Good": 35000, "Excellent": 75000}[condition]
        wf_mult = 1.35 if waterfront else 1.0

        price = (base + (sqft * 165) + (bedrooms * 12000) + (bathrooms * 15000) + (lot_size * 4) + cond_add) * n_mult * wf_mult
        # Add realistic noise
        price += random.gauss(0, 18000)
        price = max(65000, round(price, -2))

        # Introduce a few realistic missing values or edge cases for profiling detection
        bedrooms_val = "" if i == 14 else bedrooms
        sqft_val = "" if i == 42 else sqft

        rows.append({
            "id": 1000 + i,
            "price": price,
            "bedrooms": bedrooms_val,
            "bathrooms": bathrooms,
            "sqft_living": sqft_val,
            "lot_size": lot_size,
            "floors": floors,
            "waterfront": waterfront,
            "year_built": year_built,
            "neighborhood": neighborhood,
            "condition": condition,
        })

    with open(SAMPLE_DIR / "housing.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def generate_churn(n=300):
    rows = []
    contracts = ["Month-to-month", "One year", "Two year"]
    internets = ["DSL", "Fiber optic", "No"]
    payments = ["Electronic check", "Mailed check", "Bank transfer", "Credit card"]

    for i in range(n):
        tenure = random.randint(1, 72)
        contract = random.choice(contracts)
        internet = random.choice(internets)
        tech_support = "No" if internet == "No" else random.choice(["Yes", "No"])
        paperless = random.choice(["Yes", "No"])
        payment = random.choice(payments)

        # Base monthly charge
        base_charge = 25.0
        if internet == "Fiber optic":
            base_charge += 45.0
        elif internet == "DSL":
            base_charge += 20.0
        if tech_support == "Yes":
            base_charge += 12.0
        monthly_charges = round(base_charge + random.uniform(-4, 8), 2)
        total_charges = round(monthly_charges * tenure + random.uniform(-15, 15), 2)

        # Churn probability logic
        logit = -0.5
        if contract == "Month-to-month":
            logit += 1.3
        elif contract == "Two year":
            logit -= 1.4
        if internet == "Fiber optic":
            logit += 0.6
        if tech_support == "No":
            logit += 0.5
        if tenure < 12:
            logit += 0.8
        elif tenure > 48:
            logit -= 1.1

        prob = 1.0 / (1.0 + math.exp(-logit))
        churned = "Yes" if random.random() < prob else "No"

        # Occasional missing value
        monthly_val = "" if i == 23 else monthly_charges

        rows.append({
            "customer_id": f"CUST-{1000 + i}",
            "tenure_months": tenure,
            "contract_type": contract,
            "internet_service": internet,
            "tech_support": tech_support,
            "paperless_billing": paperless,
            "payment_method": payment,
            "monthly_charges": monthly_val,
            "total_charges": total_charges,
            "churned": churned,
        })

    with open(SAMPLE_DIR / "customer_churn.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def generate_student_performance(n=250):
    rows = []
    parent_eds = ["High School", "Some College", "Bachelor's", "Master's"]
    school_types = ["Public", "Private"]

    for i in range(n):
        hours_studied = round(random.uniform(1.0, 18.0), 1)
        attendance = round(random.uniform(60.0, 100.0), 1)
        sleep_hours = round(random.uniform(4.5, 9.5), 1)
        previous_score = round(random.uniform(45.0, 98.0), 1)
        parent_ed = random.choice(parent_eds)
        school_type = random.choice(school_types)
        activities = random.choice(["Yes", "No"])

        # Final score
        parent_bonus = {"High School": 0, "Some College": 3, "Bachelor's": 6, "Master's": 8}[parent_ed]
        score = (hours_studied * 2.2) + (attendance * 0.35) + (previous_score * 0.42) + parent_bonus + random.gauss(0, 4)
        score = max(35.0, min(100.0, round(score, 1)))

        if score < 65:
            tier = "Low"
        elif score < 85:
            tier = "Medium"
        else:
            tier = "High"

        rows.append({
            "student_id": f"STU-{2000 + i}",
            "hours_studied": hours_studied,
            "attendance_rate": attendance,
            "sleep_hours": sleep_hours,
            "previous_exam_score": previous_score,
            "parent_education": parent_ed,
            "school_type": school_type,
            "extracurricular": activities,
            "final_score": score,
            "performance_tier": tier,
        })

    with open(SAMPLE_DIR / "student_performance.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def generate_retail_sales(n=200):
    rows = []
    departments = ["Electronics", "Apparel", "Groceries", "Home & Garden"]
    start_date = date(2023, 1, 1)

    for i in range(n):
        cur_date = start_date + timedelta(days=i * 2)
        store_id = f"STORE-0{random.randint(1, 4)}"
        department = random.choice(departments)
        is_holiday = 1 if (cur_date.month == 12 and cur_date.day >= 20) or (cur_date.month == 11 and cur_date.day >= 22) else 0
        temperature = round(random.uniform(20.0, 95.0), 1)
        fuel_price = round(random.uniform(2.80, 4.20), 2)
        cpi = round(210.0 + (i * 0.08) + random.uniform(-0.5, 0.5), 2)
        unemployment = round(5.2 - (i * 0.005) + random.uniform(-0.2, 0.2), 2)

        base_sales = {"Electronics": 15000, "Apparel": 8500, "Groceries": 12000, "Home & Garden": 6500}[department]
        holiday_boost = 1.45 if is_holiday else 1.0
        weekly_sales = round((base_sales + (i * 12) + random.gauss(0, 1100)) * holiday_boost, 2)

        rows.append({
            "date": cur_date.isoformat(),
            "store_id": store_id,
            "department": department,
            "weekly_sales": weekly_sales,
            "is_holiday": is_holiday,
            "temperature": temperature,
            "fuel_price": fuel_price,
            "cpi": cpi,
            "unemployment_rate": unemployment,
        })

    with open(SAMPLE_DIR / "retail_sales.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    generate_housing()
    generate_churn()
    generate_student_performance()
    generate_retail_sales()
    print("Sample datasets generated successfully in", SAMPLE_DIR)
