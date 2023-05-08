import json
from mpi4py import MPI
import re
from collections import Counter
import pandas as pd
import numpy as np
import argparse
import time
import sys

# This function gets an input of a list of grater capital cities the auther had tweeted in
# and output a dictionary stores the number of twitters made in each greater capital cities
def num_tw_per_gcc(I_lst):
    num_tw_per_gcc_dict = {}
    for i in I_lst:
        # get the greater capital city
        loc = i[-4:] 

        # if this is the first time this author made twitter in this city,then number of twitter is 1
        if loc not in num_tw_per_gcc_dict:
            num_tw_per_gcc_dict[loc] = 1
        # increase the number of twitters made in that greater capital city
        else:
            num_tw_per_gcc_dict[loc] += 1
    
    return num_tw_per_gcc_dict

# This function get a dictionary as input and output the information required in question3
def task3(I_dict):
    O_dict = {}
    for author in I_dict.keys():
        # get the number of greater capital cities that this author has made tweets in
        num_of_gcc = len(set(I_dict[author]['gcc']))
        
        # get the required output information
        num_of_tw = I_dict[author]['count']
        num_tw_per_gcc_dict = num_tw_per_gcc(I_dict[author]['gcc'])
        
        # get the information in the format of required output table
        count = 0
        
        # the information of how many tweets is made in each greater capital cities(last column)
        for gcc in num_tw_per_gcc_dict.keys():
            if count == 0:
                tweets_distribution = str(num_tw_per_gcc_dict[gcc]) + gcc    
            else:
                tweets_distribution += ' ,' + str(num_tw_per_gcc_dict[gcc]) + gcc
            count += 1
        # create a dictionary for each author
        O_dict[author] = {}  
        # last column
        O_dict[author]['output'] = (str(num_of_gcc) 
                            + '(#' + str(num_of_tw) 
                            + ' tweets - ' 
                            + tweets_distribution + ')')
        # these two column needed for sorting
        O_dict[author]['num_of_tw'] = num_of_tw
        O_dict[author]['num_of_gcc'] = num_of_gcc
    
    return O_dict

start_time = time.time() 

parser = argparse.ArgumentParser(description='ass1_args')
parser.add_argument('twitter_file_path', type=str, help='twitter_file_path')
parser.add_argument('sal_path', type=str, help='sal_path')
args = parser.parse_args()

# Initialize MPI
comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()

with open(args.sal_path) as json_file2:
    sal_dict = json.load(json_file2)

# list for task 1,2,3
twid_lst = []
author_lst = []
location_lst = []
gcc_lst = []

# Open the file
with open(args.twitter_file_path, 'rb') as f:
    # seek for the corresponding chuck for the core to read
    file_size = f.seek(0, 2)
    chunk_size = file_size // size
    start = rank * chunk_size
    end = (rank + 1) * chunk_size
    f.seek(start)

    # read the file
    finish_read = False
    twid = None
    author = None
    location = None
    while not finish_read:
        curr_line = f.readline().decode()

        if not curr_line:
            # end of file
            break

        # try match tweet id
        if not twid:
            twid = re.search(r'"_id":\s*"([^"]+)"', curr_line)
            if twid:
                twid_lst.append(twid.group(1))
                continue
        
        # try match corresponding author
        if twid and (not author):
            author = re.search(r'"author_id":\s*"([^"]+)"', curr_line)
            if author:
                author_lst.append(author.group(1))
                continue

        # try match corresponding location
        if (twid and author) and (not location):
            location = re.search(r'"full_name":\s*"([^"]+)"', curr_line)
            if location:
                location_lst.append(location.group(1))

                # reset and head to the next item
                twid = None
                author = None
                location = None
                continue

        if f.tell() >= end and (not twid) and (not author) and (not location):
            # only stop when the current item is complete
            finish_read = True
            break

read_end_time = time.time()
print(f"Read time: {read_end_time - start_time} seconds at core {rank}")

# map each "location" to corresponding "gcc", map to NAN if not in gcc
for location in location_lst:
    address = location.lower().split(", ")

    # check whether the location is in a gcc
    is_in_gcc = False    
    for place in address:
        if place in sal_dict:
            gcc = sal_dict[place]['gcc']
            if gcc[-4] != 'r':
                # this place is INDEED in a gcc
                is_in_gcc = True
                gcc_lst.append(gcc)
                break

    if not is_in_gcc:
        gcc_lst.append(np.nan)

# dictionary for task 1
tws_df = pd.DataFrame({'Tweet Id': twid_lst, 'Author Id': author_lst, 'Greater Capital City': gcc_lst})
tws_author_count = tws_df.groupby('Author Id')['Tweet Id'].count().to_dict()

# dictionary for task 2
tws_df.dropna(inplace=True)
num_tw_in_gcc = tws_df.groupby('Greater Capital City')['Tweet Id'].count().to_dict()


# dictionary for task 3
num_tw_per_author = tws_df.groupby('Author Id')['Greater Capital City'].apply(list).to_dict()
num_tw_per_author = {author: {'count': len(gcc_lst), 'gcc': gcc_lst} for author, gcc_lst in num_tw_per_author.items()}


comm.Barrier()

if rank > 0:
    comm.send(tws_author_count, dest=0, tag=1)   # task 1
    comm.send(num_tw_in_gcc, dest=0, tag=2)      # task 2
    comm.send(num_tw_per_author, dest=0, tag=3)  # task 3
else: 
    for i in range(size):
        if i != 0:
            # task 1
            tws_author_count = dict(Counter(tws_author_count) + Counter(comm.recv(source=i, tag=1)))
            # task 2
            num_tw_in_gcc = dict(Counter(num_tw_in_gcc) + Counter(comm.recv(source=i, tag=2)))

            # task 3
            tmp = comm.recv(source=i, tag=3)
            for author in tmp.keys():
                if author in num_tw_per_author:
                    num_tw_per_author[author]['count'] += tmp[author]['count']
                    num_tw_per_author[author]['gcc'].extend(tmp[author]['gcc'])
                else:
                    num_tw_per_author[author] = tmp[author]

    
    # task 1 output
    TOP_NUM = 11   # threshold: return top ("TOP_NUM" - 1) records
    df_1 = pd.DataFrame([[author, count] for author, count in tws_author_count.items()], 
                        columns=['Author Id', 'Number of Tweets Made'])
    df_1['Rank'] = df_1['Number of Tweets Made'].rank(method='min', ascending=False)
    df_1 = df_1.sort_values(by=['Rank'], ascending=True, ignore_index=True)
    df_1 = df_1.loc[df_1[df_1['Rank'] < TOP_NUM].index, ['Rank', 'Author Id', 'Number of Tweets Made']]
    df_1['Rank'] = [str('#' + str(int(x))) for x in df_1['Rank']]
    df_1.to_csv(str((args.twitter_file_path).split('.')[0] + '_task1.csv'))

    # task 2 output
    df_2 = pd.DataFrame(list(num_tw_in_gcc.items()), columns=['Greater Capital City', 'Number of Tweets Made'])
    df_2 = df_2.sort_values(by=['Greater Capital City'], ascending=True, ignore_index=True)
    # dictionary for formatting
    gcc_name_dict = {'1gsyd': '1gsyd (Greater Sydney)',
                     '2gmel': '2gmel (Greater Melbourne)',
                     '3gbri': '3gbri (Greater Brisbane)',
                     '4gade': '4gade (Greater Adelaide)',
                     '5gper': '5gper (Greater Perth)',
                     '6ghob': '6ghob (Greater Hobart)',
                     '7gdar': '7gdar (Greater Darwin)',
                     '8acte': '8acte (Greater Canberra)',
                     '9oter': '9oter (Other Territories)'}
    df_2.replace({'Greater Capital City': gcc_name_dict}, inplace=True)
    df_2.to_csv(str((args.twitter_file_path).split('.')[0] + '_task2.csv')) 

    # task 3 output 
    task3_dict = task3(num_tw_per_author)
    data_3 = []
    for author in task3_dict.keys():
        data_3.append([author, task3_dict[author]['num_of_gcc'], task3_dict[author]['num_of_tw'], task3_dict[author]['output']])
    # build the data frame and rank according to the number of unique city and then number of tweets
    df_3 = pd.DataFrame(data_3, columns=['Author Id', 'num_of_gcc', 'num_of_tw', 'Number of Unique City Locations and #Tweets'])
    df_3['Rank'] = df_3[['num_of_gcc', 'num_of_tw']].apply(tuple,axis=1).rank(method='min',ascending=False)
    df_3 = df_3.sort_values(by=['Rank'], ascending=True, ignore_index=True)
    df_3 = df_3.loc[df_3[df_3['Rank'] < TOP_NUM].index, ['Rank','Author Id', 'Number of Unique City Locations and #Tweets']]
    df_3['Rank'] = [str('#' + str(int(x))) for x in df_3['Rank']]
    df_3.to_csv(str((args.twitter_file_path).split('.')[0] + '_task3.csv'))

    # DONE!
    end_time = time.time() 
    elapsed_time = end_time - start_time
    print(f"Elapsed time: {elapsed_time} seconds")

    sys.exit()