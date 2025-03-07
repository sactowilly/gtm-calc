import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import sqlite3
from datetime import datetime
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
import subprocess

# FIRST COMMIT to get something going on this project
# WJZ 2025
#fuckheroin

class GTMCalculator:
    def __init__(self, root):
        self.root = root
        self.root.title("GTM Calculator")
        self.root.geometry("800x600")
        
        # Set up the database
        self.setup_database()
        
        # Create GUI elements
        self.create_gui()
    
    def setup_database(self):
        # Create a database connection
        self.conn = sqlite3.connect("gtm_calculator.db")
        self.cursor = self.conn.cursor()
        
        # Create tables if they don't exist
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS calculations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT,
                date TEXT,
                total_cost REAL,
                total_price REAL,
                total_margin REAL,
                margin_percentage REAL
            )
        ''')
        
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS line_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                calculation_id INTEGER,
                name TEXT,
                cost REAL,
                price REAL,
                margin REAL,
                margin_percentage REAL,
                FOREIGN KEY (calculation_id) REFERENCES calculations (id)
            )
        ''')
        
        self.conn.commit()
    
    def create_gui(self):
        # Customer info frame
        customer_frame = ttk.LabelFrame(self.root, text="Customer Information")
        customer_frame.pack(fill="x", padx=10, pady=10)
        
        ttk.Label(customer_frame, text="Customer Name:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.customer_name = ttk.Entry(customer_frame, width=30)
        self.customer_name.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        
        ttk.Label(customer_frame, text="Date:").grid(row=0, column=2, padx=5, pady=5, sticky="w")
        self.date_entry = ttk.Entry(customer_frame, width=15)
        self.date_entry.grid(row=0, column=3, padx=5, pady=5, sticky="w")
        self.date_entry.insert(0, datetime.now().strftime("%Y-%m-%d"))
        
        # Line items frame
        line_items_frame = ttk.LabelFrame(self.root, text="Line Items")
        line_items_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Headers
        ttk.Label(line_items_frame, text="Item Name").grid(row=0, column=0, padx=5, pady=5)
        ttk.Label(line_items_frame, text="Cost ($)").grid(row=0, column=1, padx=5, pady=5)
        ttk.Label(line_items_frame, text="Price ($)").grid(row=0, column=2, padx=5, pady=5)
        ttk.Label(line_items_frame, text="Margin ($)").grid(row=0, column=3, padx=5, pady=5)
        ttk.Label(line_items_frame, text="Margin (%)").grid(row=0, column=4, padx=5, pady=5)
        
        # Line item entries
        self.line_items = []
        for i in range(10):
            item_name = ttk.Entry(line_items_frame, width=30)
            item_cost = ttk.Entry(line_items_frame, width=10)
            item_price = ttk.Entry(line_items_frame, width=10)
            item_margin = ttk.Label(line_items_frame, text="0.00", width=10)
            item_margin_percent = ttk.Label(line_items_frame, text="0.0%", width=10)
            
            item_name.grid(row=i+1, column=0, padx=5, pady=2)
            item_cost.grid(row=i+1, column=1, padx=5, pady=2)
            item_price.grid(row=i+1, column=2, padx=5, pady=2)
            item_margin.grid(row=i+1, column=3, padx=5, pady=2)
            item_margin_percent.grid(row=i+1, column=4, padx=5, pady=2)
            
            self.line_items.append((item_name, item_cost, item_price, item_margin, item_margin_percent))
        
        # Totals frame
        totals_frame = ttk.LabelFrame(self.root, text="Totals")
        totals_frame.pack(fill="x", padx=10, pady=10)
        
        ttk.Label(totals_frame, text="Total Cost:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.total_cost_label = ttk.Label(totals_frame, text="$0.00")
        self.total_cost_label.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        
        ttk.Label(totals_frame, text="Total Price:").grid(row=0, column=2, padx=5, pady=5, sticky="w")
        self.total_price_label = ttk.Label(totals_frame, text="$0.00")
        self.total_price_label.grid(row=0, column=3, padx=5, pady=5, sticky="w")
        
        ttk.Label(totals_frame, text="Total Margin:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.total_margin_label = ttk.Label(totals_frame, text="$0.00")
        self.total_margin_label.grid(row=1, column=1, padx=5, pady=5, sticky="w")
        
        ttk.Label(totals_frame, text="Margin Percentage:").grid(row=1, column=2, padx=5, pady=5, sticky="w")
        self.margin_percentage_label = ttk.Label(totals_frame, text="0.0%")
        self.margin_percentage_label.grid(row=1, column=3, padx=5, pady=5, sticky="w")
        
        # Buttons frame
        buttons_frame = ttk.Frame(self.root)
        buttons_frame.pack(fill="x", padx=10, pady=10)
        
        ttk.Button(buttons_frame, text="Calculate", command=self.calculate_gtm).grid(row=0, column=0, padx=5, pady=5)
        ttk.Button(buttons_frame, text="Save", command=self.save_calculation).grid(row=0, column=1, padx=5, pady=5)
        ttk.Button(buttons_frame, text="Export to PDF", command=self.export_to_pdf).grid(row=0, column=2, padx=5, pady=5)
        ttk.Button(buttons_frame, text="Browse Saved", command=self.browse_saved).grid(row=0, column=3, padx=5, pady=5)
        ttk.Button(buttons_frame, text="Clear", command=self.clear_form).grid(row=0, column=4, padx=5, pady=5)
    
    def calculate_gtm(self):
        total_cost = 0.0
        total_price = 0.0
        
        # Calculate margin for each line item
        for i, (name, cost, price, margin, margin_percent) in enumerate(self.line_items):
            if name.get() and cost.get() and price.get():
                try:
                    cost_val = float(cost.get())
                    price_val = float(price.get())
                    margin_val = price_val - cost_val
                    
                    if price_val > 0:
                        margin_percent_val = (margin_val / price_val) * 100
                    else:
                        margin_percent_val = 0
                    
                    margin.config(text=f"{margin_val:.2f}")
                    margin_percent.config(text=f"{margin_percent_val:.1f}%")
                    
                    total_cost += cost_val
                    total_price += price_val
                except ValueError:
                    messagebox.showerror("Invalid Input", f"Invalid cost or price for line item {i+1}")
                    return
        
        # Calculate total margin and percentage
        total_margin = total_price - total_cost
        if total_price > 0:
            margin_percentage = (total_margin / total_price) * 100
        else:
            margin_percentage = 0
        
        # Update total labels
        self.total_cost_label.config(text=f"${total_cost:.2f}")
        self.total_price_label.config(text=f"${total_price:.2f}")
        self.total_margin_label.config(text=f"${total_margin:.2f}")
        self.margin_percentage_label.config(text=f"{margin_percentage:.1f}%")
    
    def save_calculation(self):
        if not self.customer_name.get():
            messagebox.showerror("Missing Information", "Please enter a customer name.")
            return
        
        # Calculate first to ensure values are up to date
        self.calculate_gtm()
        
        try:
            # Extract totals
            total_cost = float(self.total_cost_label.cget("text").replace("$", ""))
            total_price = float(self.total_price_label.cget("text").replace("$", ""))
            total_margin = float(self.total_margin_label.cget("text").replace("$", ""))
            margin_percentage = float(self.margin_percentage_label.cget("text").replace("%", ""))
            
            # Save to database
            self.cursor.execute('''
                INSERT INTO calculations (customer_name, date, total_cost, total_price, total_margin, margin_percentage)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                self.customer_name.get(),
                self.date_entry.get(),
                total_cost,
                total_price,
                total_margin,
                margin_percentage
            ))
            
            calculation_id = self.cursor.lastrowid
            
            # Save line items
            for name, cost, price, margin, margin_percent in self.line_items:
                if name.get() and cost.get() and price.get():
                    cost_val = float(cost.get())
                    price_val = float(price.get())
                    margin_val = float(margin.cget("text"))
                    margin_percent_val = float(margin_percent.cget("text").replace("%", ""))
                    
                    self.cursor.execute('''
                        INSERT INTO line_items (calculation_id, name, cost, price, margin, margin_percentage)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        calculation_id,
                        name.get(),
                        cost_val,
                        price_val,
                        margin_val,
                        margin_percent_val
                    ))
            
            self.conn.commit()
            messagebox.showinfo("Success", "Calculation saved successfully!")
        except Exception as e:
            messagebox.showerror("Error", f"An error occurred: {str(e)}")
    
    def export_to_pdf(self):
        if not self.customer_name.get():
            messagebox.showerror("Missing Information", "Please enter a customer name.")
            return
        
        # Calculate first to ensure values are up to date
        self.calculate_gtm()
        
        try:
            # Set up the PDF document
            file_name = f"GTM_{self.customer_name.get().replace(' ', '_')}_{self.date_entry.get()}.pdf"
            doc = SimpleDocTemplate(file_name, pagesize=letter)
            styles = getSampleStyleSheet()
            elements = []
            
            # Title
            title = Paragraph(f"GTM Calculation for {self.customer_name.get()}", styles['Title'])
            elements.append(title)
            
            # Date
            date_para = Paragraph(f"Date: {self.date_entry.get()}", styles['Normal'])
            elements.append(date_para)
            elements.append(Paragraph("", styles['Normal']))
            
            # Line items table
            data = [["Item Name", "Cost ($)", "Price ($)", "Margin ($)", "Margin (%)"]]
            
            for name, cost, price, margin, margin_percent in self.line_items:
                if name.get() and cost.get() and price.get():
                    data.append([
                        name.get(),
                        cost.get(),
                        price.get(),
                        margin.cget("text"),
                        margin_percent.cget("text")
                    ])
            
            # Add totals row
            data.append([
                "TOTALS",
                self.total_cost_label.cget("text"),
                self.total_price_label.cget("text"),
                self.total_margin_label.cget("text"),
                self.margin_percentage_label.cget("text")
            ])
            
            table = Table(data, colWidths=[200, 70, 70, 70, 70])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.whitesmoke])
            ]))
            
            elements.append(table)
            
            # Build the PDF
            doc.build(elements)
            
            messagebox.showinfo("Success", f"PDF exported successfully to {file_name}")
            
            # Open the PDF
            if os.name == 'nt':  # Windows
                os.startfile(file_name)
            elif os.name == 'posix':  # macOS or Linux
                try:
                    subprocess.run(['open', file_name], check=True)
                except:
                    try:
                        subprocess.run(['xdg-open', file_name], check=True)
                    except:
                        pass
        except Exception as e:
            messagebox.showerror("Error", f"An error occurred: {str(e)}")
    
    def browse_saved(self):
        # Create a new window for browsing
        browse_window = tk.Toplevel(self.root)
        browse_window.title("Browse Saved Calculations")
        browse_window.geometry("900x600")
        
        # Create a treeview to display saved calculations
        columns = ("id", "customer", "date", "total_cost", "total_price", "total_margin", "margin_percentage")
        tree = ttk.Treeview(browse_window, columns=columns, show="headings")
        
        # Set column headings
        tree.heading("id", text="ID")
        tree.heading("customer", text="Customer")
        tree.heading("date", text="Date")
        tree.heading("total_cost", text="Total Cost")
        tree.heading("total_price", text="Total Price")
        tree.heading("total_margin", text="Total Margin")
        tree.heading("margin_percentage", text="Margin %")
        
        # Set column widths
        tree.column("id", width=50)
        tree.column("customer", width=150)
        tree.column("date", width=100)
        tree.column("total_cost", width=100)
        tree.column("total_price", width=100)
        tree.column("total_margin", width=100)
        tree.column("margin_percentage", width=100)
        
        # Add a scrollbar
        scrollbar = ttk.Scrollbar(browse_window, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscroll=scrollbar.set)
        
        # Pack the treeview and scrollbar
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Fetch and display saved calculations
        self.cursor.execute('''
            SELECT id, customer_name, date, total_cost, total_price, total_margin, margin_percentage
            FROM calculations ORDER BY date DESC
        ''')
        
        for calculation in self.cursor.fetchall():
            tree.insert("", tk.END, values=(
                calculation[0],
                calculation[1],
                calculation[2],
                f"${calculation[3]:.2f}",
                f"${calculation[4]:.2f}",
                f"${calculation[5]:.2f}",
                f"{calculation[6]:.1f}%"
            ))
        
        # Function to load selected calculation
        def load_calculation():
            selected_item = tree.selection()
            if not selected_item:
                messagebox.showinfo("Selection", "Please select a calculation to load")
                return
            
            item_id = tree.item(selected_item[0], "values")[0]
            
            # Fetch calculation data
            self.cursor.execute('''
                SELECT customer_name, date, total_cost, total_price, total_margin, margin_percentage
                FROM calculations WHERE id = ?
            ''', (item_id,))
            calculation = self.cursor.fetchone()
            
            if calculation:
                # Load customer info
                self.customer_name.delete(0, tk.END)
                self.customer_name.insert(0, calculation[0])
                
                self.date_entry.delete(0, tk.END)
                self.date_entry.insert(0, calculation[1])
                
                # Fetch line items
                self.cursor.execute('''
                    SELECT name, cost, price, margin, margin_percentage
                    FROM line_items WHERE calculation_id = ?
                ''', (item_id,))
                
                line_items = self.cursor.fetchall()
                
                # Clear current line items
                self.clear_form()
                
                # Load line items
                for i, line_item in enumerate(line_items):
                    if i < len(self.line_items):
                        name, cost, price, margin_label, margin_percent_label = self.line_items[i]
                        
                        name.insert(0, line_item[0])
                        cost.insert(0, str(line_item[1]))
                        price.insert(0, str(line_item[2]))
                        margin_label.config(text=f"{line_item[3]:.2f}")
                        margin_percent_label.config(text=f"{line_item[4]:.1f}%")
                
                # Update totals
                self.total_cost_label.config(text=f"${calculation[2]:.2f}")
                self.total_price_label.config(text=f"${calculation[3]:.2f}")
                self.total_margin_label.config(text=f"${calculation[4]:.2f}")
                self.margin_percentage_label.config(text=f"{calculation[5]:.1f}%")
                
                browse_window.destroy()
                messagebox.showinfo("Success", "Calculation loaded successfully!")
        
        # Function to export selected calculation to PDF
        def export_selected_to_pdf():
            selected_item = tree.selection()
            if not selected_item:
                messagebox.showinfo("Selection", "Please select a calculation to export")
                return
            
            item_id = tree.item(selected_item[0], "values")[0]
            
            # Fetch calculation data
            self.cursor.execute('''
                SELECT customer_name, date, total_cost, total_price, total_margin, margin_percentage
                FROM calculations WHERE id = ?
            ''', (item_id,))
            calculation = self.cursor.fetchone()
            
            if calculation:
                try:
                    # Set up the PDF document
                    file_name = f"GTM_{calculation[0].replace(' ', '_')}_{calculation[1]}.pdf"
                    doc = SimpleDocTemplate(file_name, pagesize=letter)
                    styles = getSampleStyleSheet()
                    elements = []
                    
                    # Title
                    title = Paragraph(f"GTM Calculation for {calculation[0]}", styles['Title'])
                    elements.append(title)
                    
                    # Date
                    date_para = Paragraph(f"Date: {calculation[1]}", styles['Normal'])
                    elements.append(date_para)
                    elements.append(Paragraph("", styles['Normal']))
                    
                    # Fetch line items
                    self.cursor.execute('''
                        SELECT name, cost, price, margin, margin_percentage
                        FROM line_items WHERE calculation_id = ?
                    ''', (item_id,))
                    
                    line_items = self.cursor.fetchall()
                    
                    # Line items table
                    data = [["Item Name", "Cost ($)", "Price ($)", "Margin ($)", "Margin (%)"]]
                    
                    for line_item in line_items:
                        data.append([
                            line_item[0],
                            f"{line_item[1]:.2f}",
                            f"{line_item[2]:.2f}",
                            f"{line_item[3]:.2f}",
                            f"{line_item[4]:.1f}%"
                        ])
                    
                    # Add totals row
                    data.append([
                        "TOTALS",
                        f"${calculation[2]:.2f}",
                        f"${calculation[3]:.2f}",
                        f"${calculation[4]:.2f}",
                        f"{calculation[5]:.1f}%"
                    ])
                    
                    table = Table(data, colWidths=[200, 70, 70, 70, 70])
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 12),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                        ('GRID', (0, 0), (-1, -1), 1, colors.black),
                        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.whitesmoke])
                    ]))
                    
                    elements.append(table)
                    
                    # Build the PDF
                    doc.build(elements)
                    
                    messagebox.showinfo("Success", f"PDF exported successfully to {file_name}")
                    
                    # Open the PDF
                    if os.name == 'nt':  # Windows
                        os.startfile(file_name)
                    elif os.name == 'posix':  # macOS or Linux
                        try:
                            subprocess.run(['open', file_name], check=True)
                        except:
                            try:
                                subprocess.run(['xdg-open', file_name], check=True)
                            except:
                                pass
                except Exception as e:
                    messagebox.showerror("Error", f"An error occurred: {str(e)}")
        
        # Function to delete selected calculation
        def delete_calculation():
            selected_item = tree.selection()
            if not selected_item:
                messagebox.showinfo("Selection", "Please select a calculation to delete")
                return
            
            item_id = tree.item(selected_item[0], "values")[0]
            
            if messagebox.askyesno("Confirm Delete", "Are you sure you want to delete this calculation?"):
                try:
                    # Delete line items first
                    self.cursor.execute("DELETE FROM line_items WHERE calculation_id = ?", (item_id,))
                    
                    # Delete calculation
                    self.cursor.execute("DELETE FROM calculations WHERE id = ?", (item_id,))
                    
                    self.conn.commit()
                    
                    # Remove from treeview
                    tree.delete(selected_item)
                    
                    messagebox.showinfo("Success", "Calculation deleted successfully")
                except Exception as e:
                    messagebox.showerror("Error", f"An error occurred: {str(e)}")
        
        # Add buttons
        button_frame = ttk.Frame(browse_window)
        button_frame.pack(pady=10)
        
        ttk.Button(button_frame, text="Load Selected", command=load_calculation).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Export to PDF", command=export_selected_to_pdf).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Delete", command=delete_calculation).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Close", command=browse_window.destroy).pack(side=tk.LEFT, padx=5)
    
    def clear_form(self):
        # Clear customer info
        self.customer_name.delete(0, tk.END)
        self.date_entry.delete(0, tk.END)
        self.date_entry.insert(0, datetime.now().strftime("%Y-%m-%d"))
        
        # Clear line items
        for name, cost, price, margin, margin_percent in self.line_items:
            name.delete(0, tk.END)
            cost.delete(0, tk.END)
            price.delete(0, tk.END)
            margin.config(text="0.00")
            margin_percent.config(text="0.0%")
        
        # Reset totals
        self.total_cost_label.config(text="$0.00")
        self.total_price_label.config(text="$0.00")
        self.total_margin_label.config(text="$0.00")
        self.margin_percentage_label.config(text="0.0%")

def main():
    root = tk.Tk()
    app = GTMCalculator(root)
    root.mainloop()

if __name__ == "__main__":
    main()
