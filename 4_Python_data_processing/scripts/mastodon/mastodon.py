class MastodonData:
    def __init__(self, server):
        self.server_name = server
        self.client_id=os.environ.get(f"MASTODON_{server}_CLIENT_KEY")
        self.client_secret=os.environ.get(f"MASTODON_{server}_CLIENT_SECRET")
        self.access_token=os.environ.get(f"MASTODON_{server}_ACCESS_TOKEN")
        self.api_base_url=os.environ.get(f"MASTODON_{server}_URL")
        
    def __repr__(self):
        return f"Mastodon server: {self.server_name}"
    
    
def create_mastodon_client(MastodonData):
    return Mastodon(
        client_id=MastodonData.client_id,
        client_secret=MastodonData.client_secret,
        access_token=MastodonData.access_token,
        api_base_url=MastodonData.api_base_url
    )

def get_40_response(mastodon_client):
    response = mastodon_client.timeline_public(min_id=103388556664584957, limit=40)
    for i, res in enumerate(response):
        response[i] = extract_mastodon_info(res).to_dict()
    return response