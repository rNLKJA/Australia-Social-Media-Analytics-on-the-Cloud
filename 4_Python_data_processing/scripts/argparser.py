import argparse

parser = argparse.ArgumentParser(description='CCC A2 Large Twitter Processor')
parser.add_argument('-t', '--twitter_file', type=str, help='target twitter file')
# parser.add_argument('-s', '--sal_path', type=str, help='sal_path')
parser.add_argument('-d', '--database', type=str, help="database name", default="twitter")

args = parser.parse_args()