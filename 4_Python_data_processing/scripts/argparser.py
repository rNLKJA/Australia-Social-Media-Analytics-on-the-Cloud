import argparse

parser = argparse.ArgumentParser(description='CCC A2 Large Twitter Processor')
parser.add_argument('twitter_file_path', type=str, help='twitter_file_path')
parser.add_argument('sal_path', type=str, help='sal_path')

args = parser.parse_args()